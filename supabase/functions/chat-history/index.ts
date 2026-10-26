import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CREOVA AI chat history (cloud).
//
// The chat tables are written only by trusted server code (see the
// ai_assistant_foundation migration), so every read/write goes through this
// function with the service role. Each query is scoped to the authenticated
// user, and every incoming id/path is validated.
//
// POST JSON { action, ... }
//   list                 -> { conversations: [...] }
//   get                  -> { conversation, messages }       (conversationId)
//   sync                 -> { updatedAt }  (conversationId, title, upsert[], remove[])
//   delete_conversation  -> {}             (conversationId)

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const BUCKET = "generation-assets";
const FILE_BUCKET = "chat-files";
const LIST_LIMIT = 200;
const GET_LIMIT = 500;
const MAX_UPSERT = 100;
const MAX_REMOVE = 300;
const MAX_CONTENT = 20000;
const MAX_TITLE = 80;
const MIN_TIME = 1577836800000; // 2020-01-01
const DAY_MS = 86400000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

// ===== PURE HELPERS =====
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// Postgres rejects lone surrogates, so never cut a string in the middle of a pair.
function safeSlice(value: string, max: number): string {
  if (value.length <= max) return value;
  let out = value.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  return out;
}

function cleanTitle(value: unknown): string {
  if (typeof value !== "string") return "";
  return safeSlice(value.replace(/\s+/g, " ").trim(), MAX_TITLE);
}

function clampTime(value: unknown, now: number): string {
  const n = typeof value === "number" ? value : Number.NaN;
  const ok = Number.isFinite(n) && n >= MIN_TIME && n <= now + DAY_MS;
  return new Date(ok ? n : now).toISOString();
}

function isSafePath(path: string, userId: string): boolean {
  return (
    path.length <= 300 &&
    path.startsWith(`${userId}/`) &&
    !path.includes("..") &&
    !path.includes("//")
  );
}

interface ParsedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  message_type: "text" | "voice" | "image" | "file";
  audio_url: string | null;
  audio_duration_ms: number | null;
  image_path: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  generation_id: string | null;
  created_at: string;
}

function parseMessages(raw: unknown, userId: string, now: number): ParsedMessage[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, "upsert must be an array.");
  if (raw.length > MAX_UPSERT) {
    throw new HttpError(400, `At most ${MAX_UPSERT} messages per request.`);
  }

  const seen = new Set<string>();
  const out: ParsedMessage[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") throw new HttpError(400, "Invalid message.");
    const m = item as Record<string, unknown>;

    if (!isUuid(m.id)) throw new HttpError(400, "Invalid message id.");
    if (seen.has(m.id)) throw new HttpError(400, "Duplicate message id.");
    seen.add(m.id);

    const role = m.role === "user" || m.role === "assistant" ? m.role : null;
    if (!role) throw new HttpError(400, "Invalid message role.");

    const type =
      m.messageType === "voice" || m.messageType === "image" || m.messageType === "file"
        ? m.messageType
        : "text";
    const content = typeof m.content === "string" ? safeSlice(m.content, MAX_CONTENT) : "";
    if (type === "text" && content.trim().length === 0) {
      throw new HttpError(400, "Text message is empty.");
    }

    let audio: string | null = null;
    if (m.audioPath !== undefined && m.audioPath !== null) {
      if (typeof m.audioPath !== "string" || !isSafePath(m.audioPath, userId)) {
        throw new HttpError(400, "Invalid audio path.");
      }
      audio = m.audioPath;
    }

    let image: string | null = null;
    if (m.imagePath !== undefined && m.imagePath !== null) {
      if (typeof m.imagePath !== "string" || !isSafePath(m.imagePath, userId)) {
        throw new HttpError(400, "Invalid image path.");
      }
      image = m.imagePath;
    }

    let file: string | null = null;
    if (m.filePath !== undefined && m.filePath !== null) {
      if (typeof m.filePath !== "string" || !isSafePath(m.filePath, userId)) {
        throw new HttpError(400, "Invalid file path.");
      }
      file = m.filePath;
    }
    const fileName =
      typeof m.fileName === "string" && m.fileName.length > 0
        // deno-lint-ignore no-control-regex
        ? safeSlice(m.fileName.replace(/[\u0000-\u001f\u007f]/g, "?"), 200)
        : null;
    const fs = m.fileSize;
    const fileSize =
      typeof fs === "number" && Number.isFinite(fs) && fs >= 0 && fs <= 2 ** 40 ? Math.floor(fs) : null;
    const fileMime =
      typeof m.fileMime === "string" &&
      m.fileMime.length <= 100 &&
      /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(m.fileMime)
        ? m.fileMime.toLowerCase()
        : null;

    const d = m.audioDurationMs;
    const duration =
      typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 600000 ? d : null;

    out.push({
      id: m.id,
      role,
      content,
      message_type: type,
      audio_url: audio,
      audio_duration_ms: duration,
      image_path: image,
      file_path: file,
      file_name: fileName,
      file_size: fileSize,
      file_mime: fileMime,
      generation_id: isUuid(m.generationId) ? m.generationId : null,
      created_at: clampTime(m.createdAt, now),
    });
  }

  return out;
}

function parseIds(raw: unknown, max: number): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > max) {
    throw new HttpError(400, "Invalid id list.");
  }
  const ids: string[] = [];
  for (const id of raw) {
    if (!isUuid(id)) throw new HttpError(400, "Invalid id.");
    ids.push(id);
  }
  return [...new Set(ids)];
}
// ===== END PURE HELPERS =====

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed." }, 405);
  }

  const token = request.headers
    .get("Authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return json({ success: false, error: "Authentication required." }, 401);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json({ success: false, error: "Server configuration is missing." }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ success: false, error: "Invalid or expired authentication token." }, 401);
    }
    const userId = authData.user.id;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new HttpError(400, "Invalid JSON body.");
    }

    switch (body.action) {
      case "list":
        return json(await listConversations(admin, userId));
      case "get":
        return json(await getConversation(admin, userId, body.conversationId));
      case "sync":
        return json(await syncConversation(admin, userId, body));
      case "delete_conversation":
        return json(await deleteConversation(admin, userId, body.conversationId));
      default:
        throw new HttpError(400, "Unknown action.");
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("chat-history error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected error.",
      },
      500,
    );
  }
});

// deno-lint-ignore no-explicit-any
type Admin = any;

async function listConversations(admin: Admin, userId: string) {
  let { data, error } = await admin
    .from("chat_conversations")
    .select("id,title,created_at,updated_at,chat_messages(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    // Fall back to a plain list if the relation count is unavailable.
    const retry = await admin
      .from("chat_conversations")
      .select("id,title,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(LIST_LIMIT);
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new HttpError(500, error.message);

  // deno-lint-ignore no-explicit-any
  const conversations = (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: Number(row.chat_messages?.[0]?.count ?? 0),
  }));

  return { success: true, conversations, limit: LIST_LIMIT };
}

async function getConversation(admin: Admin, userId: string, conversationId: unknown) {
  if (!isUuid(conversationId)) throw new HttpError(400, "Invalid conversation id.");

  const { data: conv, error: convError } = await admin
    .from("chat_conversations")
    .select("id,user_id,title,created_at,updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (convError) throw new HttpError(500, convError.message);
  if (!conv) throw new HttpError(404, "Conversation not found.");

  const { data: rows, error } = await admin
    .from("chat_messages")
    .select(
      "id,role,content,message_type,audio_url,audio_duration_ms,image_path,file_path,file_name,file_size,file_mime,generation_id,created_at",
    )
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    // Newest first so that a long chat keeps its LATEST messages; reversed below.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(GET_LIMIT);
  if (error) throw new HttpError(500, error.message);

  return {
    success: true,
    conversation: {
      id: conv.id,
      title: conv.title ?? "",
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
    },
    // deno-lint-ignore no-explicit-any
    messages: [...(rows ?? [])].reverse().map((r: any) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      messageType: r.message_type,
      audioPath: r.audio_url ?? null,
      audioDurationMs: r.audio_duration_ms ?? null,
      imagePath: r.image_path ?? null,
      filePath: r.file_path ?? null,
      fileName: r.file_name ?? null,
      fileSize: r.file_size == null ? null : Number(r.file_size),
      fileMime: r.file_mime ?? null,
      generationId: r.generation_id ?? null,
      createdAt: r.created_at,
    })),
  };
}

async function removeRecordings(
  admin: Admin,
  userId: string,
  conversationId: string,
  paths: unknown[],
  bucket: string = BUCKET,
) {
  // Only files uploaded for this chat (<user>/<conversation>/...) are deleted.
  // Generated media (<user>/<generation>.*) belongs to the generation history.
  const prefix = `${userId}/${conversationId}/`;
  const own = [
    ...new Set(
      paths.filter((p): p is string => typeof p === "string" && p.startsWith(prefix)),
    ),
  ];
  if (own.length === 0) return;
  try {
    await admin.storage.from(bucket).remove(own);
  } catch (e) {
    console.warn("chat-history: could not remove recordings:", e);
  }
}

async function syncConversation(
  admin: Admin,
  userId: string,
  body: Record<string, unknown>,
) {
  const conversationId = body.conversationId;
  if (!isUuid(conversationId)) throw new HttpError(400, "Invalid conversation id.");

  const title = cleanTitle(body.title);
  const rows = parseMessages(body.upsert, userId, Date.now());
  const removeIds = parseIds(body.remove, MAX_REMOVE);

  const { data: existing, error: existingError } = await admin
    .from("chat_conversations")
    .select("id,user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (existingError) throw new HttpError(500, existingError.message);
  if (existing && existing.user_id !== userId) {
    throw new HttpError(403, "Conversation belongs to another user.");
  }

  // Upsert always runs an UPDATE on existing rows, which bumps updated_at (trigger).
  const { data: convRow, error: convError } = await admin
    .from("chat_conversations")
    .upsert({ id: conversationId, user_id: userId, title }, { onConflict: "id" })
    .select("updated_at")
    .single();
  if (convError) throw new HttpError(500, convError.message);

  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);

    const { data: clash, error: clashError } = await admin
      .from("chat_messages")
      .select("id,user_id,conversation_id")
      .in("id", ids);
    if (clashError) throw new HttpError(500, clashError.message);
    // deno-lint-ignore no-explicit-any
    if ((clash ?? []).some((r: any) => r.user_id !== userId || r.conversation_id !== conversationId)) {
      throw new HttpError(409, "Message id conflict.");
    }

    const gens = [...new Set(rows.map((r) => r.generation_id).filter((g): g is string => !!g))];
    if (gens.length > 0) {
      const { data: owned } = await admin
        .from("generation_history")
        .select("id")
        .in("id", gens)
        .eq("user_id", userId);
      const { data: taken } = await admin
        .from("chat_messages")
        .select("id,generation_id")
        .in("generation_id", gens);
      // deno-lint-ignore no-explicit-any
      const ownedSet = new Set((owned ?? []).map((g: any) => g.id));
      for (const row of rows) {
        if (!row.generation_id) continue;
        const usedElsewhere = (taken ?? []).some(
          // deno-lint-ignore no-explicit-any
          (t: any) => t.generation_id === row.generation_id && t.id !== row.id,
        );
        if (!ownedSet.has(row.generation_id) || usedElsewhere) row.generation_id = null;
      }
    }

    const { error } = await admin.from("chat_messages").upsert(
      rows.map((r) => ({ ...r, conversation_id: conversationId, user_id: userId })),
      { onConflict: "id" },
    );
    if (error) throw new HttpError(500, error.message);
  }

  if (removeIds.length > 0) {
    const { data: doomed } = await admin
      .from("chat_messages")
      .select("id,audio_url,image_path,file_path")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .in("id", removeIds);

    const { error } = await admin
      .from("chat_messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .in("id", removeIds);
    if (error) throw new HttpError(500, error.message);

    // deno-lint-ignore no-explicit-any
    await removeRecordings(admin, userId, conversationId, (doomed ?? []).flatMap((d: any) => [d.audio_url, d.image_path]));
    // deno-lint-ignore no-explicit-any
    await removeRecordings(admin, userId, conversationId, (doomed ?? []).map((d: any) => d.file_path), FILE_BUCKET);
  }

  return { success: true, updatedAt: convRow.updated_at };
}

async function deleteConversation(admin: Admin, userId: string, conversationId: unknown) {
  if (!isUuid(conversationId)) throw new HttpError(400, "Invalid conversation id.");

  const { data: conv, error: convError } = await admin
    .from("chat_conversations")
    .select("id,user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (convError) throw new HttpError(500, convError.message);
  if (!conv) return { success: true }; // already gone: deleting is idempotent
  if (conv.user_id !== userId) throw new HttpError(403, "Conversation belongs to another user.");

  const { data: msgs } = await admin
    .from("chat_messages")
    .select("audio_url,image_path,file_path")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  // Messages are removed by the ON DELETE CASCADE foreign key.
  const { error } = await admin
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (error) throw new HttpError(500, error.message);

  // deno-lint-ignore no-explicit-any
  await removeRecordings(admin, userId, conversationId, (msgs ?? []).flatMap((m: any) => [m.audio_url, m.image_path]));
  // deno-lint-ignore no-explicit-any
  await removeRecordings(admin, userId, conversationId, (msgs ?? []).map((m: any) => m.file_path), FILE_BUCKET);
  return { success: true };
    }
