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
  if (
    typeof globalThis.crypto?.randomUUID ===
    "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (
    typeof globalThis.crypto?.getRandomValues ===
    "function"
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (
      let index = 0;
      index < bytes.length;
      index += 1
    ) {
      bytes[index] =
        Math.floor(Math.random() * 256);
    }
  }

  bytes[6] =
    (bytes[6] & 0x0f) | 0x40;

  bytes[8] =
    (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes).map(
    (byte) =>
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

function isGenerationType(
  value: unknown,
): value is GenerationType {
  return (
    value === "chat" ||
    value === "code" ||
    value === "image" ||
    value === "video" ||
    value === "music" ||
    value === "voice"
  );
}

function isGenerationStatus(
  value: unknown,
): value is GenerationStatus {
  return (
    value === "queued" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  );
}

function normalizeMetadata(
  value: unknown,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
}

function normalizeGeneration(
  value: unknown,
): GenerationRecord | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    !isGenerationType(row.type) ||
    !isGenerationStatus(row.status)
  ) {
    return null;
  }

  const metadata =
    normalizeMetadata(
      row.metadata,
    );

  const metadataCost =
    Number(metadata.coinCost);

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    coinCost:
      Number.isFinite(metadataCost)
        ? metadataCost
        : getFeatureCost(row.type),
    prompt:
      typeof row.prompt === "string"
        ? row.prompt
        : undefined,
    metadata,
    resultText:
      typeof row.result_text ===
      "string"
        ? row.result_text
        : null,
    resultUrl:
      typeof row.result_url ===
      "string"
        ? row.result_url
        : null,
    provider:
      typeof row.provider ===
      "string"
        ? row.provider
        : null,
    model:
      typeof row.model ===
      "string"
        ? row.model
        : null,
    errorMessage:
      typeof row.error_message ===
      "string"
        ? row.error_message
        : null,
    createdAt:
      typeof row.created_at ===
      "string"
        ? row.created_at
        : undefined,
    startedAt:
      typeof row.started_at ===
      "string"
        ? row.started_at
        : null,
    completedAt:
      typeof row.completed_at ===
      "string"
        ? row.completed_at
        : null,
  };
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
  if (!isGenerationType(type)) {
    return {
      success: false,
      error:
        "Invalid generation type.",
    };
  }

  const cleanPrompt =
    typeof prompt === "string"
      ? prompt.trim()
      : "";

  if (!cleanPrompt) {
    return {
      success: false,
      error:
        "Prompt is required.",
    };
  }

  if (cleanPrompt.length > 12000) {
    return {
      success: false,
      error:
        "Prompt is too long.",
    };
  }

  const {
    data: {
      user,
    },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      success: false,
      error: userError.message,
    };
  }

  if (!user) {
    return {
      success: false,
      error:
        "Authentication required.",
    };
  }

  const generationId =
    createGenerationId();

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "generation-record",
      {
        body: {
          generationId,
          type,
          prompt: cleanPrompt,
          metadata: {
            ...metadata,
            feature: type,
            coinCost:
              getFeatureCost(type),
          },
        },
      },
    );

  if (error) {
    return {
      success: false,
      generationId,
      error: error.message,
    };
  }

  if (
    !data?.success ||
    !data?.generation
  ) {
    return {
      success: false,
      generationId,
      error:
        data?.error ??
        "Generation could not be created.",
    };
  }

  const normalized =
    normalizeGeneration(
      data.generation,
    );

  if (!normalized) {
    return {
      success: false,
      generationId,
      error:
        "Invalid generation record returned by server.",
    };
  }

  return {
    success: true,
    generationId:
      normalized.id,
    data: normalized,
  };
}

export async function getGeneration(
  generationId: string,
): Promise<
  GenerationResult<GenerationRecord>
> {
  const cleanId =
    generationId.trim();

  if (!cleanId) {
    return {
      success: false,
      error:
        "Generation ID is required.",
    };
  }

  const {
    data: {
      user,
    },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      success: false,
      error: userError.message,
    };
  }

  if (!user) {
    return {
      success: false,
      error:
        "Authentication required.",
    };
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("generation_history")
      .select("*")
      .eq("id", cleanId)
      .eq("user_id", user.id)
      .maybeSingle();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data) {
    return {
      success: false,
      error:
        "Generation not found.",
    };
  }

  const normalized =
    normalizeGeneration(data);

  if (!normalized) {
    return {
      success: false,
      error:
        "Invalid generation record.",
    };
  }

  return {
    success: true,
    generationId:
      normalized.id,
    data: normalized,
  };
}

export async function updateGeneration(
  generationId: string,
  updates: Partial<
    Pick<
      GenerationRecord,
      | "status"
      | "resultText"
      | "resultUrl"
      | "provider"
      | "model"
      | "errorMessage"
      | "metadata"
    >
  >,
): Promise<
  GenerationResult<GenerationRecord>
> {
  const cleanId =
    generationId.trim();

  if (!cleanId) {
    return {
      success: false,
      error:
        "Generation ID is required.",
    };
  }

  const {
    data: {
      user,
    },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      success: false,
      error: userError.message,
    };
  }

  if (!user) {
    return {
      success: false,
      error:
        "Authentication required.",
    };
  }

  const payload: Record<
    string,
    unknown
  > = {};

  if (
    updates.status !== undefined
  ) {
    payload.status =
      updates.status;
  }

  if (
    updates.resultText !== undefined
  ) {
    payload.result_text =
      updates.resultText;
  }

  if (
    updates.resultUrl !== undefined
  ) {
    payload.result_url =
      updates.resultUrl;
  }

  if (
    updates.provider !== undefined
  ) {
    payload.provider =
      updates.provider;
  }

  if (
    updates.model !== undefined
  ) {
    payload.model =
      updates.model;
  }

  if (
    updates.errorMessage !== undefined
  ) {
    payload.error_message =
      updates.errorMessage;
  }

  if (
    updates.metadata !== undefined
  ) {
    payload.metadata =
      updates.metadata;
  }

  if (
    Object.keys(payload).length === 0
  ) {
    return getGeneration(cleanId);
  }

  const {
    data,
    error,
  } =
    await supabase
      .from("generation_history")
      .update(payload)
      .eq("id", cleanId)
      .eq("user_id", user.id)
      .select("*")
      .single();

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  const normalized =
    normalizeGeneration(data);

  if (!normalized) {
    return {
      success: false,
      error:
        "Invalid generation record.",
    };
  }

  return {
    success: true,
    generationId:
      normalized.id,
    data: normalized,
  };
}