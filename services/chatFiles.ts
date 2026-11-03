/**
 * CREOVA
 * Files that the user attaches to a chat message (zip, pdf, documents, audio, video, ...).
 *
 * The file is uploaded to the private `chat-files` bucket, in the user's own folder:
 *   <user_id>/<conversation_id>/<message_id>.<ext>
 * The `chat-file` Edge Function then reads it (a zip is read through HTTP Range requests,
 * big pdf/audio/video go to the Gemini Files API), so files of any practical size work.
 */

import * as DocumentPicker from "expo-document-picker";

import { supabase } from "./supabase";

export const FILE_BUCKET = "chat-files";
// Matches the bucket limit set by the migration. The project-wide Supabase limit
// (Free plan: 50 MB) can be lower; the storage server answers 413 in that case.
export const MAX_FILE_BYTES = 500 * 1024 * 1024;
// Above this size the file is never read into memory by the fallback upload.
const MEMORY_UPLOAD_MAX = 50 * 1024 * 1024;

export interface PickedFile {
  uri: string;
  name: string;
  size: number | null;
  mime: string;
}

const EXT_MIME: Record<string, string> = {
  zip: "application/zip",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  aac: "audio/aac",
  mp4: "video/mp4",
  mov: "video/quicktime",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function sanitizeFileName(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

// Short, safe extension (letters and digits only) or an empty string.
export function extensionOf(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  const ext = base.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

export function guessMime(name: string, mime?: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m && m !== "application/octet-stream" && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(m)) return m;
  return EXT_MIME[extensionOf(name)] ?? "application/octet-stream";
}

export function storagePathFor(
  userId: string,
  conversationId: string,
  messageId: string,
  fileName: string,
): string {
  return `${userId}/${conversationId}/${messageId}.${extensionOf(fileName) || "bin"}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Opens the system file picker. Returns null when the user cancels.
export async function pickChatFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const name = sanitizeFileName(asset.name ?? "file");
  const size = typeof asset.size === "number" ? asset.size : null;
  if (size !== null && size > MAX_FILE_BYTES) {
    throw Object.assign(new Error("The file is too large."), { status: 413 });
  }
  return { uri: asset.uri, name, size, mime: guessMime(name, asset.mimeType) };
}

type StorageFailure = "duplicate" | "too_large" | "permission" | "retry";

export function classifyStorageError(error: unknown): StorageFailure {
  const e = error as { statusCode?: unknown; status?: unknown; message?: unknown } | null;
  const status = Number(e?.statusCode ?? e?.status);
  const message = String(e?.message ?? "").toLowerCase();
  if (status === 409 || /already exists|duplicate/.test(message)) return "duplicate";
  if (status === 413 || /exceed|too large|maximum allowed size/.test(message)) return "too_large";
  if (status === 401 || status === 403 || /row-level security|unauthorized|not allowed/.test(message)) {
    return "permission";
  }
  return "retry";
}

function toFailure(error: unknown, kind: StorageFailure): Error {
  const base = error instanceof Error ? error : new Error(String((error as any)?.message ?? "Upload failed."));
  const status = kind === "too_large" ? 413 : kind === "permission" ? 403 : undefined;
  return Object.assign(base, status ? { status } : {});
}

/**
 * Uploads the file to the user's folder. The primary way is a multipart upload that React Native
 * streams from disk, so even big files do not fill the JS memory. If that fails for a
 * temporary reason, files up to 50 MB are retried by reading them into memory.
 */
export async function uploadChatFile(path: string, file: PickedFile): Promise<void> {
  const storage = supabase.storage.from(FILE_BUCKET);

  try {
    const form = new FormData();
    form.append("file", { uri: file.uri, name: file.name, type: file.mime } as unknown as Blob);
    const { error } = await storage.upload(path, form, { contentType: file.mime, upsert: false });
    if (!error) return;
    const kind = classifyStorageError(error);
    if (kind === "duplicate") return;
    if (kind !== "retry") throw toFailure(error, kind);
  } catch (e) {
    const kind = classifyStorageError(e);
    if (kind === "duplicate") return;
    if (kind === "too_large" || kind === "permission") throw toFailure(e, kind);
    // temporary problem: try the fallback below
  }

  if (file.size !== null && file.size > MEMORY_UPLOAD_MAX) {
    throw Object.assign(new Error("Network request failed"), { name: "FunctionsFetchError" });
  }
  const response = await fetch(file.uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error("The file is empty.");
  const { error } = await storage.upload(path, bytes, { contentType: file.mime, upsert: false });
  if (!error) return;
  const kind = classifyStorageError(error);
  if (kind === "duplicate") return;
  throw toFailure(error, kind);
  }
