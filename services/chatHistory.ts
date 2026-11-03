/**
 * CREOVA
 * Cloud chat history (client side).
 *
 * Source of truth: the `chat-history` Edge Function (chat_conversations /
 * chat_messages tables). This module adds what a mobile app needs on top:
 *
 *  - an OUTBOX (persisted on the device) so nothing is lost when the user is
 *    offline or the app is closed before a save finished;
 *  - a small CACHE (persisted on the device) for instant start and offline reading;
 *  - pure helpers (diffing, merging, mapping) that are unit tested.
 *
 * Writes are idempotent (messages have client generated UUIDs and are upserted),
 * so retrying an operation can never create duplicates.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { invokeEdgeFunction } from "./edgeFunctions";
import { supabase } from "./supabase";

// ---------------------------------------------------------------- types

export type Attachment = "image" | "voice" | "file";

export interface ChatMessage {
  id: string; // UUID (client generated)
  sender: "user" | "ai";
  text: string;
  createdAt: number; // ms, strictly increasing on one device
  attachment?: Attachment;
  imageUri?: string; // display URL (local file or signed URL)
  audioUri?: string; // display URL (local file or signed URL)
  audioPath?: string; // storage path in the private bucket
  audioDurationMs?: number;
  imagePath?: string; // storage path of a photo the user sent
  generationId?: string; // generated image => file is <user>/<generationId>.png
  mediaMime?: string; // mime of a local file that still has to be uploaded
  filePath?: string; // path in the private chat-files bucket
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  fileUri?: string; // local copy while the file is being uploaded (never saved)
  fileStatus?: "uploading"; // transient, never saved
  isError?: boolean;
  retryable?: boolean;
  detail?: string;
  errorKey?: string;
}

export interface CachedMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  createdAt: number;
  attachment?: Attachment;
  audioPath?: string;
  audioDurationMs?: number;
  imagePath?: string;
  generationId?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  messages?: CachedMessage[]; // present only for conversations cached for offline use
}

export interface ChatCache {
  activeId: string | null;
  conversations: ConversationSummary[];
}

export interface PendingMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  messageType: "text" | "voice" | "image" | "file";
  createdAt: number;
  audioPath?: string;
  audioDurationMs?: number;
  imagePath?: string;
  generationId?: string;
  localAudioUri?: string; // recorded file that must be uploaded before saving
  localAudioMime?: string;
  localImageUri?: string; // photo that must be uploaded before saving
  localImageMime?: string;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
}

export type OutboxOp =
  | {
      opId: string;
      type: "sync";
      conversationId: string;
      title: string;
      upsert: PendingMessage[];
      remove: string[];
    }
  | { opId: string; type: "delete"; conversationId: string };

type EdgeError = (Error & { status?: number }) | null;

export interface HistoryDeps {
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  invoke(body: Record<string, unknown>): Promise<{ data: any; error: EdgeError }>;
  upload(path: string, localUri: string, mime: string): Promise<void>;
  sign(paths: string[]): Promise<Record<string, string>>;
}

// ------------------------------------------------------------ constants

export const ASSET_BUCKET = "generation-assets";
const SYNC_UPSERT_CHUNK = 100; // server limit: 100 messages per request
const SYNC_REMOVE_CHUNK = 300; // server limit: 300 ids per request
const MAX_OUTBOX_OPS = 500;
const MAX_CACHED_CONVERSATIONS = 8;
const MAX_CACHED_MESSAGES = 200;
const MAX_LIST = 200;
const SIGN_CHUNK = 100;
const SIGNED_URL_SECONDS = 3600;
// The bucket accepts only these (see the chat migrations).
const UPLOADABLE_AUDIO = new Set(["audio/mp4", "audio/x-m4a", "audio/m4a"]);
const UPLOADABLE_IMAGE = new Set(["image/jpeg"]);

const cacheKey = (userId: string) => `creova.aichat.v2.${userId}`;
const outboxKey = (userId: string) => `creova.aichat.outbox.v1.${userId}`;

// -------------------------------------------------------------- helpers

export function uuid(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)];
    else out += hex[Math.floor(Math.random() * 16)];
  }
  return out;
}

let lastTimestamp = 0;
// Strictly increasing millisecond clock: the server orders messages by created_at.
export function nextTimestamp(): number {
  const now = Date.now();
  lastTimestamp = now > lastTimestamp ? now : lastTimestamp + 1;
  return lastTimestamp;
}

const isLocalUri = (uri?: string): boolean => !!uri && /^(file|content|blob|data):/i.test(uri);

// Never cuts an emoji (surrogate pair) in half: Postgres rejects a lone surrogate.
export function safeSlice(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = text.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  return out;
}

export function makeTitle(msgs: ChatMessage[]): string {
  const first = msgs.find((m) => m.sender === "user" && m.text.trim().length > 0);
  return safeSlice((first?.text ?? "").replace(/\s+/g, " ").trim(), 50);
}

export function imagePathFor(userId: string, generationId: string): string {
  return `${userId}/${generationId}.png`;
}

// A photo the user sent has its own path; a generated image is derived from its generation id.
export function imageStoragePath(userId: string, m: ChatMessage): string | undefined {
  if (m.attachment !== "image") return undefined;
  if (m.imagePath) return m.imagePath;
  return m.generationId ? imagePathFor(userId, m.generationId) : undefined;
}

// ------------------------------------------------- message <-> cloud

function toPending(m: ChatMessage): PendingMessage {
  const messageType =
    m.attachment === "voice"
      ? "voice"
      : m.attachment === "image"
        ? "image"
        : m.attachment === "file"
          ? "file"
          : "text";
  const mime = m.mediaMime ?? "";
  const upload =
    messageType === "voice" &&
    !m.audioPath &&
    isLocalUri(m.audioUri) &&
    UPLOADABLE_AUDIO.has(mime);
  const uploadImage =
    messageType === "image" &&
    !m.imagePath &&
    isLocalUri(m.imageUri) &&
    UPLOADABLE_IMAGE.has(mime);

  return {
    id: m.id,
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text,
    messageType,
    createdAt: m.createdAt,
    audioPath: m.audioPath,
    audioDurationMs:
      typeof m.audioDurationMs === "number" ? Math.max(0, Math.round(m.audioDurationMs)) : undefined,
    imagePath: m.imagePath,
    generationId: m.generationId,
    filePath: m.filePath,
    fileName: m.fileName,
    fileSize: typeof m.fileSize === "number" ? Math.max(0, Math.round(m.fileSize)) : undefined,
    fileMime: m.fileMime,
    localAudioUri: upload ? m.audioUri : undefined,
    localAudioMime: upload ? mime : undefined,
    localImageUri: uploadImage ? m.imageUri : undefined,
    localImageMime: uploadImage ? mime : undefined,
  };
}

export function rowToMessage(row: any): ChatMessage | null {
  if (!row || typeof row.id !== "string") return null;
  if (row.role !== "user" && row.role !== "assistant") return null;
  const created = Date.parse(String(row.createdAt));
  return {
    id: row.id,
    sender: row.role === "user" ? "user" : "ai",
    text: typeof row.content === "string" ? row.content : "",
    createdAt: Number.isFinite(created) ? created : 0,
    attachment:
      row.messageType === "voice"
        ? "voice"
        : row.messageType === "image"
          ? "image"
          : row.messageType === "file"
            ? "file"
            : undefined,
    audioPath: typeof row.audioPath === "string" ? row.audioPath : undefined,
    audioDurationMs: typeof row.audioDurationMs === "number" ? row.audioDurationMs : undefined,
    imagePath: typeof row.imagePath === "string" ? row.imagePath : undefined,
    filePath: typeof row.filePath === "string" ? row.filePath : undefined,
    fileName: typeof row.fileName === "string" ? row.fileName : undefined,
    fileSize: typeof row.fileSize === "number" ? row.fileSize : undefined,
    fileMime: typeof row.fileMime === "string" ? row.fileMime : undefined,
    generationId: typeof row.generationId === "string" ? row.generationId : undefined,
  };
}

// ------------------------------------------------------------- diffing

export interface SyncPlan {
  ops: OutboxOp[];
  known: string[]; // ids the cloud will have once the ops are delivered
}

/**
 * Compares the messages on screen with what the cloud already knows and builds
 * the operations that bring the cloud up to date (new messages, removed messages
 * after an edit, and explicitly "dirty" messages that changed).
 *
 * `existingTitle` is the title the cloud already has for this conversation. It is
 * used when we know nothing about its messages (e.g. it could not be loaded), so
 * a new message can never overwrite a good title.
 */
export function planSync(
  conversationId: string,
  messages: ChatMessage[],
  known: string[],
  dirtyIds: string[] = [],
  existingTitle?: string,
): SyncPlan {
  const clean = messages.filter((m) => !m.isError);
  const cleanIds = new Set(clean.map((m) => m.id));
  const knownSet = new Set(known);
  const dirty = new Set(dirtyIds);

  const remove = known.filter((id) => !cleanIds.has(id));
  const upsert = clean.filter((m) => !knownSet.has(m.id) || dirty.has(m.id));
  const newKnown = clean.map((m) => m.id);

  if (remove.length === 0 && upsert.length === 0) return { ops: [], known: newKnown };

  const title =
    known.length === 0 && existingTitle !== undefined ? existingTitle : makeTitle(clean);

  const ops: OutboxOp[] = [];
  const upserts = upsert.map(toPending);
  const total = Math.max(
    Math.ceil(upserts.length / SYNC_UPSERT_CHUNK),
    Math.ceil(remove.length / SYNC_REMOVE_CHUNK),
    1,
  );
  for (let i = 0; i < total; i++) {
    ops.push({
      opId: uuid(),
      type: "sync",
      conversationId,
      title,
      upsert: upserts.slice(i * SYNC_UPSERT_CHUNK, (i + 1) * SYNC_UPSERT_CHUNK),
      remove: remove.slice(i * SYNC_REMOVE_CHUNK, (i + 1) * SYNC_REMOVE_CHUNK),
    });
  }
  return { ops, known: newKnown };
}

// --------------------------------------------------------------- cache

export function toCached(m: ChatMessage): CachedMessage {
  return {
    id: m.id,
    sender: m.sender,
    text: m.text,
    createdAt: m.createdAt,
    attachment: m.attachment,
    audioPath: m.audioPath,
    audioDurationMs: m.audioDurationMs,
    imagePath: m.imagePath,
    generationId: m.generationId,
    filePath: m.filePath,
    fileName: m.fileName,
    fileSize: m.fileSize,
    fileMime: m.fileMime,
  };
}

export function fromCached(c: CachedMessage): ChatMessage {
  return { ...c };
}

export function emptyCache(): ChatCache {
  return { activeId: null, conversations: [] };
}

export function sanitizeCache(raw: unknown): ChatCache {
  const cache = emptyCache();
  if (!raw || typeof raw !== "object") return cache;
  const obj = raw as { activeId?: unknown; conversations?: unknown };
  if (!Array.isArray(obj.conversations)) return cache;

  for (const c of obj.conversations) {
    if (!c || typeof c !== "object") continue;
    const conv = c as Partial<ConversationSummary>;
    if (typeof conv.id !== "string" || conv.id.length === 0) continue;

    let messages: CachedMessage[] | undefined;
    if (Array.isArray(conv.messages)) {
      messages = [];
      for (const m of conv.messages) {
        if (!m || typeof m !== "object") continue;
        const msg = m as Partial<CachedMessage>;
        if (
          typeof msg.id !== "string" ||
          (msg.sender !== "user" && msg.sender !== "ai") ||
          typeof msg.text !== "string"
        ) {
          continue;
        }
        messages.push({
          id: msg.id,
          sender: msg.sender,
          text: msg.text,
          createdAt: typeof msg.createdAt === "number" ? msg.createdAt : 0,
          attachment:
            msg.attachment === "image" || msg.attachment === "voice" || msg.attachment === "file"
              ? msg.attachment
              : undefined,
          audioPath: typeof msg.audioPath === "string" ? msg.audioPath : undefined,
          audioDurationMs: typeof msg.audioDurationMs === "number" ? msg.audioDurationMs : undefined,
          imagePath: typeof msg.imagePath === "string" ? msg.imagePath : undefined,
          generationId: typeof msg.generationId === "string" ? msg.generationId : undefined,
          filePath: typeof msg.filePath === "string" ? msg.filePath : undefined,
          fileName: typeof msg.fileName === "string" ? msg.fileName : undefined,
          fileSize: typeof msg.fileSize === "number" ? msg.fileSize : undefined,
          fileMime: typeof msg.fileMime === "string" ? msg.fileMime : undefined,
        });
      }
    }

    cache.conversations.push({
      id: conv.id,
      title: typeof conv.title === "string" ? conv.title : "",
      updatedAt: typeof conv.updatedAt === "number" ? conv.updatedAt : 0,
      messageCount:
        typeof conv.messageCount === "number" ? conv.messageCount : (messages?.length ?? 0),
      messages,
    });
  }

  cache.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  cache.conversations = cache.conversations.slice(0, MAX_LIST);
  cache.activeId =
    typeof obj.activeId === "string" && cache.conversations.some((c) => c.id === obj.activeId)
      ? obj.activeId
      : null;
  return cache;
}

// Keeps the cache small: all conversations stay in the list, but only the most
// recent ones (and the open one) keep their messages for offline reading.
export function trimCache(cache: ChatCache): ChatCache {
  const sorted = [...cache.conversations].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_LIST);
  const keep = new Set(sorted.slice(0, MAX_CACHED_CONVERSATIONS).map((c) => c.id));
  if (cache.activeId) keep.add(cache.activeId);
  return {
    activeId: cache.activeId,
    conversations: sorted.map((c) => ({
      ...c,
      messages: keep.has(c.id) ? c.messages?.slice(-MAX_CACHED_MESSAGES) : undefined,
    })),
  };
}

export async function loadCache(userId: string, deps: HistoryDeps = defaultDeps): Promise<ChatCache> {
  try {
    const raw = await deps.storage.getItem(cacheKey(userId));
    return raw ? sanitizeCache(JSON.parse(raw)) : emptyCache();
  } catch {
    return emptyCache();
  }
}

export async function saveCache(
  userId: string,
  cache: ChatCache,
  deps: HistoryDeps = defaultDeps,
): Promise<void> {
  try {
    await deps.storage.setItem(cacheKey(userId), JSON.stringify(trimCache(cache)));
  } catch (e) {
    console.warn("Could not save chat cache:", e);
  }
}

// Updates (or creates) one conversation in the cache from the messages on screen.
export function cacheConversation(
  cache: ChatCache,
  conversationId: string,
  messages: ChatMessage[],
  now: number,
  title?: string,
): void {
  const clean = messages.filter((m) => !m.isError);
  const existing = cache.conversations.find((c) => c.id === conversationId);
  const resolvedTitle = title !== undefined ? title : makeTitle(clean);
  const cached = clean.slice(-MAX_CACHED_MESSAGES).map(toCached);
  if (existing) {
    existing.title = resolvedTitle;
    existing.updatedAt = now;
    existing.messageCount = Math.max(clean.length, 0);
    existing.messages = cached;
  } else {
    cache.conversations.push({
      id: conversationId,
      title: resolvedTitle,
      updatedAt: now,
      messageCount: clean.length,
      messages: cached,
    });
  }
  cache.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Combines the conversation list from the cloud with the local cache.
 * - conversations deleted on this device but not yet confirmed stay hidden;
 * - conversations created here whose first save is still queued stay visible;
 * - cached messages are kept for offline reading.
 */
export function mergeConversationList(
  cloud: ConversationSummary[],
  cached: ConversationSummary[],
  ops: OutboxOp[],
): ConversationSummary[] {
  const deleting = new Set(ops.filter((o) => o.type === "delete").map((o) => o.conversationId));
  const pendingSync = new Set(ops.filter((o) => o.type === "sync").map((o) => o.conversationId));
  const cachedById = new Map(cached.map((c) => [c.id, c]));
  const cloudIds = new Set(cloud.map((c) => c.id));
  const out: ConversationSummary[] = [];

  for (const c of cloud) {
    if (deleting.has(c.id)) continue;
    const local = cachedById.get(c.id);
    if (local && pendingSync.has(c.id)) {
      // Local edits are newer than the cloud: keep them visible.
      out.push({
        id: c.id,
        title: local.title,
        updatedAt: Math.max(c.updatedAt, local.updatedAt),
        messageCount: Math.max(c.messageCount, local.messageCount),
        messages: local.messages,
      });
    } else {
      out.push({ ...c, messages: local?.messages });
    }
  }

  for (const local of cached) {
    if (cloudIds.has(local.id) || deleting.has(local.id)) continue;
    if (pendingSync.has(local.id)) out.push(local);
  }

  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function hasPendingOps(ops: OutboxOp[], conversationId: string): boolean {
  return ops.some((o) => o.conversationId === conversationId);
}

// --------------------------------------------------------------- outbox

let outboxLock: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = outboxLock.then(fn, fn);
  outboxLock = run.catch(() => undefined);
  return run;
}

function sanitizeOps(raw: unknown): OutboxOp[] {
  if (!Array.isArray(raw)) return [];
  const ops: OutboxOp[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const op = item as any;
    if (typeof op.opId !== "string" || typeof op.conversationId !== "string") continue;
    if (op.type === "delete") {
      ops.push({ opId: op.opId, type: "delete", conversationId: op.conversationId });
    } else if (op.type === "sync" && Array.isArray(op.upsert) && Array.isArray(op.remove)) {
      ops.push({
        opId: op.opId,
        type: "sync",
        conversationId: op.conversationId,
        title: typeof op.title === "string" ? op.title : "",
        upsert: op.upsert.filter((m: any) => m && typeof m.id === "string"),
        remove: op.remove.filter((id: any) => typeof id === "string"),
      });
    }
  }
  return ops;
}

export async function loadOutbox(userId: string, deps: HistoryDeps = defaultDeps): Promise<OutboxOp[]> {
  try {
    const raw = await deps.storage.getItem(outboxKey(userId));
    return raw ? sanitizeOps(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

async function writeOutbox(userId: string, ops: OutboxOp[], deps: HistoryDeps): Promise<void> {
  await deps.storage.setItem(outboxKey(userId), JSON.stringify(ops));
}

export function enqueueOps(
  userId: string,
  newOps: OutboxOp[],
  deps: HistoryDeps = defaultDeps,
): Promise<OutboxOp[]> {
  return withLock(async () => {
    const ops = await loadOutbox(userId, deps);
    ops.push(...newOps);
    // Safety cap: drop the oldest operations rather than growing without limit.
    const capped = ops.length > MAX_OUTBOX_OPS ? ops.slice(ops.length - MAX_OUTBOX_OPS) : ops;
    await writeOutbox(userId, capped, deps);
    return capped;
  });
}

// 400/403/409/413/422 cannot succeed by retrying; everything else (offline,
// 401, 404 = function not deployed yet, 429, 5xx) is retried later.
export function isPermanentFailure(error: unknown): boolean {
  const status = typeof (error as any)?.status === "number" ? (error as any).status : undefined;
  return status === 400 || status === 403 || status === 409 || status === 413 || status === 422;
}

type MediaOutcome = "done" | "drop" | "retry";

function classifyUploadError(error: any): MediaOutcome {
  if (error?.kind === "read") return "drop"; // local file is gone: save the message without it
  const status = Number(error?.statusCode ?? error?.status);
  const message = String(error?.message ?? "").toLowerCase();
  if (status === 409 || /already exists|duplicate/.test(message)) return "done";
  if (
    [400, 403, 413, 415, 422].includes(status) ||
    /mime|too large|exceeded|not allowed|unsupported/.test(message)
  ) {
    return "drop";
  }
  return "retry";
}

function extensionFor(mime: string): string {
  if (mime === "audio/mp4" || mime === "audio/x-m4a" || mime === "audio/m4a") return "m4a";
  if (mime === "image/jpeg") return "jpg";
  return "bin";
}

export interface FlushResult {
  sent: number;
  remaining: number;
  failed: boolean;
}

// Only one flush runs at a time. If another flush is requested meanwhile (for
// example the app returned to the foreground right after a message was queued),
// it joins the running one and the queue is checked once more when it finishes.
let flushInFlight: Promise<FlushResult> | null = null;
let flushAgain = false;

export function flushOutbox(userId: string, deps: HistoryDeps = defaultDeps): Promise<FlushResult> {
  if (flushInFlight) {
    flushAgain = true;
    return flushInFlight;
  }
  flushInFlight = (async () => {
    try {
      let result = await flushOnce(userId, deps);
      while (flushAgain && !result.failed) {
        flushAgain = false;
        result = await flushOnce(userId, deps);
      }
      return result;
    } finally {
      flushInFlight = null;
      flushAgain = false;
    }
  })();
  return flushInFlight;
}

type SyncOp = Extract<OutboxOp, { type: "sync" }>;

// Uploads the files that belong to the messages of one operation. A temporary
// failure (offline) asks the caller to retry later; a file that can never be
// uploaded (missing, wrong type, too large) is skipped so the text is still saved.
async function uploadLocalMedia(
  userId: string,
  op: SyncOp,
  deps: HistoryDeps,
): Promise<{ op: SyncOp; retry: boolean }> {
  const upsert: PendingMessage[] = [];

  for (const m of op.upsert) {
    let next: PendingMessage = m;
    const jobs: { kind: "audio" | "image"; uri: string; mime: string }[] = [];
    if (m.localAudioUri) {
      jobs.push({ kind: "audio", uri: m.localAudioUri, mime: m.localAudioMime ?? "audio/mp4" });
    }
    if (m.localImageUri) {
      jobs.push({ kind: "image", uri: m.localImageUri, mime: m.localImageMime ?? "image/jpeg" });
    }

    for (const job of jobs) {
      const path = `${userId}/${op.conversationId}/${m.id}.${extensionFor(job.mime)}`;
      let outcome: MediaOutcome = "done";
      try {
        await deps.upload(path, job.uri, job.mime);
      } catch (e) {
        outcome = classifyUploadError(e);
      }
      if (outcome === "retry") return { op, retry: true };
      if (outcome === "done") {
        next = job.kind === "audio" ? { ...next, audioPath: path } : { ...next, imagePath: path };
      }
    }

    const {
      localAudioUri: _audioUri,
      localAudioMime: _audioMime,
      localImageUri: _imageUri,
      localImageMime: _imageMime,
      ...rest
    } = next;
    upsert.push(rest);
  }

  return { op: { ...op, upsert }, retry: false };
}

/**
 * Sends queued operations one by one, in order. Stops at the first temporary
 * failure (the queue is kept and retried later). Operations that can never
 * succeed are dropped so they do not block the queue forever.
 */
async function flushOnce(userId: string, deps: HistoryDeps): Promise<FlushResult> {
  let sent = 0;

  for (let guard = 0; guard < MAX_OUTBOX_OPS + 5; guard++) {
    const ops = await withLock(() => loadOutbox(userId, deps));
    if (ops.length === 0) return { sent, remaining: 0, failed: false };

    let op = ops[0];

    if (op.type === "sync") {
      // 1) Upload recordings and photos that are still only on this phone.
      if (op.upsert.some((m) => m.localAudioUri || m.localImageUri)) {
        const uploaded = await uploadLocalMedia(userId, op, deps);
        if (uploaded.retry) return { sent, remaining: ops.length, failed: true };
        const updated = uploaded.op;
        op = updated;
        await withLock(async () => {
          const current = await loadOutbox(userId, deps);
          const next = current.map((o) => (o.opId === updated.opId ? updated : o));
          await writeOutbox(userId, next, deps);
        });
      }

      // 2) Save the messages.
      const { data, error } = await deps.invoke({
        action: "sync",
        conversationId: op.conversationId,
        title: op.title,
        upsert: op.upsert.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          messageType: m.messageType,
          audioPath: m.audioPath ?? null,
          audioDurationMs: m.audioDurationMs ?? null,
          imagePath: m.imagePath ?? null,
          filePath: m.filePath ?? null,
          fileName: m.fileName ?? null,
          fileSize: m.fileSize ?? null,
          fileMime: m.fileMime ?? null,
          generationId: m.generationId ?? null,
          createdAt: m.createdAt,
        })),
        remove: op.remove,
      });

      if (error || (data && data.success === false)) {
        const failure = error ?? Object.assign(new Error(String(data?.error ?? "sync failed")), {});
        if (!isPermanentFailure(failure)) {
          return { sent, remaining: ops.length, failed: true };
        }
        console.warn("Dropping chat sync that cannot succeed:", failure.message);
      }
    } else {
      const { data, error } = await deps.invoke({
        action: "delete_conversation",
        conversationId: op.conversationId,
      });
      if (error || (data && data.success === false)) {
        const failure = error ?? Object.assign(new Error(String(data?.error ?? "delete failed")), {});
        if (!isPermanentFailure(failure)) {
          return { sent, remaining: ops.length, failed: true };
        }
        console.warn("Dropping chat delete that cannot succeed:", failure.message);
      }
    }

    const doneId = op.opId;
    await withLock(async () => {
      const current = await loadOutbox(userId, deps);
      await writeOutbox(
        userId,
        current.filter((o) => o.opId !== doneId),
        deps,
      );
    });
    sent++;
  }

  const left = await withLock(() => loadOutbox(userId, deps));
  return { sent, remaining: left.length, failed: left.length > 0 };
}

// ---------------------------------------------------------- cloud reads

export async function fetchConversationList(
  deps: HistoryDeps = defaultDeps,
): Promise<ConversationSummary[] | null> {
  const { data, error } = await deps.invoke({ action: "list" });
  if (error || !data || !Array.isArray(data.conversations)) return null;

  const out: ConversationSummary[] = [];
  for (const row of data.conversations) {
    if (!row || typeof row.id !== "string") continue;
    const updated = Date.parse(String(row.updatedAt));
    out.push({
      id: row.id,
      title: typeof row.title === "string" ? row.title : "",
      updatedAt: Number.isFinite(updated) ? updated : 0,
      messageCount: Number(row.messageCount) || 0,
    });
  }
  return out;
}

export type ConversationFetch =
  | { status: "ok"; title: string; messages: ChatMessage[] }
  | { status: "missing" } // the cloud does not have it (deleted elsewhere / never saved)
  | { status: "error" }; // offline or server problem: keep what we have

export async function fetchConversation(
  conversationId: string,
  deps: HistoryDeps = defaultDeps,
): Promise<ConversationFetch> {
  const { data, error } = await deps.invoke({ action: "get", conversationId });
  if (error) {
    return error.status === 404 && /conversation not found/i.test(error.message)
      ? { status: "missing" }
      : { status: "error" };
  }
  if (!data || !Array.isArray(data.messages)) return { status: "error" };

  const messages: ChatMessage[] = [];
  for (const row of data.messages) {
    const m = rowToMessage(row);
    if (m) messages.push(m);
  }
  return {
    status: "ok",
    title: typeof data.conversation?.title === "string" ? data.conversation.title : "",
    messages,
  };
}

// Files that belong to messages (recordings, generated images) are private, so
// they are opened through short-lived signed URLs created on demand.
export function mediaPathsFor(userId: string, msgs: ChatMessage[]): string[] {
  const paths = new Set<string>();
  for (const m of msgs) {
    if (m.audioPath && !m.audioUri) paths.add(m.audioPath);
    const image = imageStoragePath(userId, m);
    if (image && !m.imageUri) paths.add(image);
  }
  return [...paths];
}

export async function resolveMedia(
  userId: string,
  msgs: ChatMessage[],
  deps: HistoryDeps = defaultDeps,
): Promise<ChatMessage[]> {
  const paths = mediaPathsFor(userId, msgs);
  if (paths.length === 0) return msgs;

  const urls: Record<string, string> = {};
  for (let i = 0; i < paths.length; i += SIGN_CHUNK) {
    try {
      Object.assign(urls, await deps.sign(paths.slice(i, i + SIGN_CHUNK)));
    } catch (e) {
      console.warn("Could not create signed URLs:", e);
    }
  }

  return msgs.map((m) => {
    let next = m;
    if (m.audioPath && !m.audioUri && urls[m.audioPath]) {
      next = { ...next, audioUri: urls[m.audioPath] };
    }
    const image = imageStoragePath(userId, m);
    if (image && !m.imageUri && urls[image]) {
      next = { ...next, imageUri: urls[image] };
    }
    return next;
  });
}

// ----------------------------------------------------- default (real) deps

export const defaultDeps: HistoryDeps = {
  storage: AsyncStorage,

  invoke: (body) => invokeEdgeFunction<any>("chat-history", { body }),

  upload: async (path, localUri, mime) => {
    let bytes: ArrayBuffer;
    try {
      const response = await fetch(localUri);
      bytes = await response.arrayBuffer();
      if (bytes.byteLength === 0) throw new Error("File is empty");
    } catch (e) {
      throw Object.assign(e instanceof Error ? e : new Error("File not readable"), { kind: "read" });
    }
    const { error } = await supabase.storage
      .from(ASSET_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
  },

  sign: async (paths) => {
    const { data, error } = await supabase.storage
      .from(ASSET_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;
    const out: Record<string, string> = {};
    (data ?? []).forEach((item) => {
      if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
    });
    return out;
  },
};
