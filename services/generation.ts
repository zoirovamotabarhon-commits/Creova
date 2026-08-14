import { supabase } from "./supabase";
import { getFeatureCost } from "./featureCosts";

export type GenerationType =
  | "chat"
  | "code"
  | "image"
  | "video"
  | "music"
  | "voice";

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GenerationRecord {
  id: string;
  userId: string;
  type: GenerationType;
  status: GenerationStatus;
  coinCost: number;
  prompt?: string;
  metadata?: Record<string, unknown>;
  resultText?: string | null;
  resultUrl?: string | null;
  provider?: string | null;
  model?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface GenerationResult<T = unknown> {
  success: boolean;
  generationId?: string;
  data?: T;
  error?: string;
}

function createGenerationId(): string {
  const cryptoObject =
    globalThis.crypto;

  if (
    cryptoObject &&
    typeof cryptoObject.randomUUID ===
      "function"
  ) {
    return cryptoObject.randomUUID();
  }

  const bytes =
    new Uint8Array(16);

  if (
    cryptoObject &&
    typeof cryptoObject.getRandomValues ===
      "function"
  ) {
    cryptoObject.getRandomValues(
      bytes,
    );
  } else {
    for (
      let index = 0;
      index < bytes.length;
      index += 1
    ) {
      bytes[index] =
        Math.floor(
          Math.random() * 256,
        );
    }
  }

  bytes[6] =
    (bytes[6] & 0x0f) |
    0x40;

  bytes[8] =
    (bytes[8] & 0x3f) |
    0x80;

  const hex = Array.from(
    bytes,
  ).map((byte) =>
    byte
      .toString(16)
      .padStart(2, "0"),
  );

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

export async function createGeneration(
  type: GenerationType,
  _coinCost?: number,
  prompt?: string,
  metadata: Record<
    string,
    unknown
  > = {},
): Promise<
  GenerationResult<GenerationRecord>
> {
  const cleanPrompt =
    prompt?.trim() ?? "";

  if (!cleanPrompt) {
    return {
      success: false,
      error:
        "Prompt is required.",
    };
  }

  const {
    data: {
      user,
    },
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError) {
    return {
      success: false,
      error:
        userError.message,
    };
  }

  if (!user) {
    return {
      success: false,
      error:
        "
