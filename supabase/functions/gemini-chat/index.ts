import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

// CREOVA AI: text chat, voice questions and image questions through Gemini.
//
// Two request formats are accepted (both are used by the app):
//   A) AI Chat screen:   { prompt | message | text, history: [{ role, text }],
//                          systemPrompt?, audioBase64?, audioMimeType?, max_tokens? }
//   B) Other screens:    { messages: [{ role: "user" | "assistant" | "system", content }],
//                          systemPrompt?, imageUrl?, max_tokens?, generationId?, generationType? }
//
// The answer is { success, text, message, content, model }. Every Gemini call has its own
// time limit and the whole request has a budget below the 60 s the app waits, so the app
// gets a real answer or a real error instead of a silent timeout.

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"];
const ATTEMPT_TIMEOUT_MS = 20_000; // one Gemini call
const TOTAL_BUDGET_MS = 50_000; // all calls together (the app waits 60 s)
const DEFAULT_MAX_TOKENS = 2048;
const MIN_MAX_TOKENS = 256;
const MAX_MAX_TOKENS = 8192;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

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

export interface Turn {
  role: "user" | "model";
  text: string;
}

export interface InlinePart {
  data: string;
  mimeType: string;
}

export interface ParsedRequest {
  systemPrompt: string;
  history: Turn[];
  prompt: string;
  audio: InlinePart | null;
  imageUrl: string;
  maxTokens: number;
  generationId: string;
  generationType: string;
  conversationId: string;
}

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

// Gemini needs the conversation to alternate user/model, start with a user turn and end
// with a model turn. Failed turns in the app leave several user messages in a row, so
// they are merged; a trailing user turn becomes part of the new question.
export function normalizeTurns(
  turns: Turn[],
  prompt: string,
): { history: Turn[]; prompt: string } {
  const merged: Turn[] = [];
  for (const turn of turns) {
    const text = turn.text.trim();
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) last.text += `\n${text}`;
    else merged.push({ role: turn.role, text });
  }
  while (merged.length > 0 && merged[0].role !== "user") merged.shift();
  const tail = merged[merged.length - 1];
  let finalPrompt = prompt;
  if (tail && tail.role === "user") {
    finalPrompt = prompt ? `${tail.text}\n${prompt}` : tail.text;
    merged.pop();
  }
  return { history: merged, prompt: finalPrompt };
}

export function clampMaxTokens(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_TOKENS;
  return Math.min(MAX_MAX_TOKENS, Math.max(MIN_MAX_TOKENS, Math.floor(n)));
}

export function parseRequest(raw: unknown): ParsedRequest {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  let systemPrompt = clean(b.systemPrompt);
  let prompt = clean(b.prompt) || clean(b.message) || clean(b.text);
  const turns: Turn[] = [];

  if (Array.isArray(b.messages)) {
    for (const item of b.messages) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      const text = clean(m.content) || clean(m.text);
      if (!text) continue;
      if (m.role === "system") {
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${text}` : text;
        continue;
      }
      turns.push({ role: m.role === "user" ? "user" : "model", text });
    }
    if (!prompt) {
      const last = turns[turns.length - 1];
      if (last && last.role === "user") {
        prompt = last.text;
        turns.pop();
      }
    }
  } else if (Array.isArray(b.history)) {
    for (const item of b.history) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      const text = clean(m.text) || clean(m.content) || clean(m.prompt);
      if (!text) continue;
      turns.push({ role: m.role === "user" ? "user" : "model", text });
    }
  }

  const normalized = normalizeTurns(turns, prompt);

  const audioData = clean(b.audioBase64).replace(/^data:[^;]+;base64,/, "");
  const audio: InlinePart | null = audioData
    ? { data: audioData, mimeType: clean(b.audioMimeType) || "audio/mp4" }
    : null;

  return {
    systemPrompt,
    history: normalized.history,
    prompt: normalized.prompt,
    audio,
    imageUrl: clean(b.imageUrl),
    maxTokens: clampMaxTokens(b.max_tokens ?? b.maxTokens),
    generationId: clean(b.generationId),
    generationType: clean(b.generationType),
    conversationId: clean(b.conversationId),
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function loadImage(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<InlinePart> {
  const dataUrl = /^data:([^;,]+);base64,(.+)$/is.exec(url);
  if (dataUrl) return { mimeType: dataUrl[1], data: dataUrl[2] };
  if (!/^https?:\/\//i.test(url)) {
    throw new HttpError(400, "imageUrl must be an https or data URL.");
  }
  const res = await fetchFn(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(400, `Could not download the image (${res.status}).`);
  const declared = Number(res.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    throw new HttpError(413, "The image is too large.");
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "The image is too large.");
  return {
    data: bytesToBase64(bytes),
    mimeType: res.headers.get("content-type")?.split(";")[0] || "image/jpeg",
  };
}

export interface ChatLike {
  sendMessage(parts: unknown): Promise<{ response: { text(): string } }>;
}
export interface ModelLike {
  startChat(options: unknown): ChatLike;
}
export interface GenAILike {
  getGenerativeModel(params: unknown, requestOptions?: unknown): ModelLike;
}

export interface GenerateOptions {
  models: string[];
  systemInstruction: string;
  history: Turn[];
  parts: unknown[];
  maxTokens: number;
  attemptTimeoutMs: number;
  totalBudgetMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface GenerateFailure {
  message: string;
  statuses: number[];
}

// A call that hangs is abandoned after `ms`, whatever the SDK does with its own timeout.
export function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Request timed out after ${ms} ms`), { name: "AbortError" }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const isTimeout = (e: any): boolean =>
  e?.name === "AbortError" || /abort|timed? ?out/i.test(String(e?.message ?? ""));

// Tries the models in order. A busy/limited model (503/429) gets one more try, a slow one
// (timeout) is skipped at once, and no call is started when less than 2 s of the budget is left.
export async function generateWithFallback(
  genAI: GenAILike,
  opts: GenerateOptions,
): Promise<{ text: string; model: string }> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = now() + opts.totalBudgetMs;
  const errors: string[] = [];
  const statuses: number[] = [];

  const chatHistory = opts.history.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));

  outer: for (const name of opts.models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - now();
      if (remaining < 2000) {
        errors.push("time budget used up");
        break outer;
      }
      try {
        const timeout = Math.min(opts.attemptTimeoutMs, remaining - 500);
        const model = genAI.getGenerativeModel(
          { model: name, ...(opts.systemInstruction ? { systemInstruction: opts.systemInstruction } : {}) },
          { timeout },
        );
        const chat = model.startChat({
          history: chatHistory,
          generationConfig: { maxOutputTokens: opts.maxTokens },
        });
        const result = await raceTimeout(chat.sendMessage(opts.parts), timeout);
        const text = result.response.text();
        if (!text || !text.trim()) {
          errors.push(`${name}: empty answer`);
          break;
        }
        return { text, model: name };
      } catch (e: any) {
        const status = typeof e?.status === "number" ? e.status : 0;
        statuses.push(status);
        errors.push(`${name} [${status || (isTimeout(e) ? "timeout" : "?")}]: ${String(e?.message ?? e).slice(0, 160)}`);
        if (status === 503 || status === 429) {
          await sleep(Math.min(700 * (attempt + 1), Math.max(0, (deadline - now()) / 4)));
          continue;
        }
        break; // slow, rejected or broken: try the next model
      }
    }
  }

  const failure: GenerateFailure = { message: `All models failed. ${errors.join(" | ")}`, statuses };
  throw Object.assign(new Error(failure.message), { statuses: failure.statuses });
}
// ===== END PURE HELPERS =====

// Marks the generation record (created by the app, coins already charged) as finished.
// Best effort: it never changes the answer the user gets.
async function finishGeneration(
  request: Request,
  generationId: string,
  outcome: { ok: true; text: string; model: string } | { ok: false; error: string },
) {
  if (!generationId) return;
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const key =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!url || !key || !token) return;

    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await admin.auth.getUser(token);
    if (!data?.user) return;

    const now = new Date().toISOString();
    const patch = outcome.ok
      ? {
          status: "completed",
          provider: "gemini",
          model: outcome.model,
          result_text: outcome.text,
          completed_at: now,
          updated_at: now,
        }
      : { status: "failed", error_message: outcome.error.slice(0, 500), completed_at: now, updated_at: now };

    await admin
      .from("generation_history")
      .update(patch)
      .eq("id", generationId)
      .eq("user_id", data.user.id)
      .in("status", ["queued", "processing"]);
  } catch (e) {
    console.warn("gemini-chat: could not update the generation record:", e);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  let generationId = "";
  try {
    const body = await request.json().catch(() => null);
    const parsed = parseRequest(body);
    generationId = parsed.generationId;

    if (!parsed.prompt && !parsed.audio && !parsed.imageUrl) {
      throw new HttpError(400, "Prompt is required");
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new HttpError(500, "GEMINI_API_KEY is not configured.");

    const parts: unknown[] = [];
    if (parsed.prompt) parts.push({ text: parsed.prompt });
    if (parsed.audio) parts.push({ inlineData: parsed.audio });
    if (parsed.imageUrl) parts.push({ inlineData: await loadImage(parsed.imageUrl) });

    const genAI = new GoogleGenerativeAI(apiKey) as unknown as GenAILike;
    const { text, model } = await generateWithFallback(genAI, {
      models: MODELS,
      systemInstruction: parsed.systemPrompt,
      history: parsed.history,
      parts,
      maxTokens: parsed.maxTokens,
      attemptTimeoutMs: ATTEMPT_TIMEOUT_MS,
      totalBudgetMs: TOTAL_BUDGET_MS,
    });

    await finishGeneration(request, generationId, { ok: true, text, model });
    return json({
      success: true,
      text,
      message: text,
      content: text,
      model,
      generationId: generationId || undefined,
      conversationId: parsed.conversationId || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    await finishGeneration(request, generationId, { ok: false, error: message });

    if (error instanceof HttpError) {
      return json({ success: false, error: message }, error.status);
    }
    console.error("gemini-chat failed:", message);
    const statuses = (error as { statuses?: number[] })?.statuses ?? [];
    const rateLimited = statuses.length > 0 && statuses.every((s) => s === 429);
    return json({ success: false, error: message }, rateLimited ? 429 : 500);
  }
});
