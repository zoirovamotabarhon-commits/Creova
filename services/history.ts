import { supabase } from "./supabase";

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

export interface GenerationHistoryItem {
  id: string;
  user_id: string;
  type: GenerationType;
  prompt: string;
  status: GenerationStatus;
  result_text?: string | null;
  result_url?: string | null;
  provider?: string | null;
  model?: string | null;
  error_message?: string | null;
  metadata: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistoryResponse {
  success: boolean;
  data?: GenerationHistoryItem[];
  error?: string;
}

export interface HistoryItemResponse {
  success: boolean;
  data?: GenerationHistoryItem;
  error?: string;
}

const GENERATION_TYPES: GenerationType[] = [
  "chat",
  "code",
  "image",
  "video",
  "music",
  "voice",
];

const GENERATION_STATUSES: GenerationStatus[] = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
];

function isGenerationType(
  value: unknown
): value is GenerationType {
  return (
    typeof value === "string" &&
    GENERATION_TYPES.includes(
      value as GenerationType
    )
  );
}

function isGenerationStatus(
  value: unknown
): value is GenerationStatus {
  return (
    typeof value === "string" &&
    GENERATION_STATUSES.includes(
      value as GenerationStatus
    )
  );
}

function normalizeItem(
  value: unknown
): GenerationHistoryItem | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const item =
    value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.user_id !== "string" ||
    !isGenerationType(item.type) ||
    !isGenerationStatus(item.status) ||
    typeof item.created_at !== "string" ||
    typeof item.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: item.id,
    user_id: item.user_id,
    type: item.type,
    prompt:
      typeof item.prompt === "string"
        ? item.prompt
        : "",
    status: item.status,
    result_text:
      typeof item.result_text === "string"
        ? item.result_text
        : null,
    result_url:
      typeof item.result_url === "string"
        ? item.result_url
        : null,
    provider:
      typeof item.provider === "string"
        ? item.provider
        : null,
    model:
      typeof item.model === "string"
        ? item.model
        : null,
    error_message:
      typeof item.error_message === "string"
        ? item.error_message
        : null,
    metadata:
      item.metadata &&
      typeof item.metadata === "object" &&
      !Array.isArray(item.metadata)
        ? (item.metadata as Record<
            string,
            unknown
          >)
        : {},
    started_at:
      typeof item.started_at === "string"
        ? item.started_at
        : null,
    completed_at:
      typeof item.completed_at === "string"
        ? item.completed_at
        : null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

export async function getGenerationHistory(
  options?: {
    type?: GenerationType;
    limit?: number;
  }
): Promise<HistoryResponse> {
  try {
    const limit = Math.min(
      Math.max(
        options?.limit ?? 50,
        1
      ),
      100
    );

    let query = supabase
      .from("generation_history")
      .select("*")
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (options?.type) {
      query = query.eq(
        "type",
        options.type
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    const normalized =
      (data ?? [])
        .map(normalizeItem)
        .filter(
          (
            item
          ): item is GenerationHistoryItem =>
            item !== null
        );

    return {
      success: true,
      data: normalized,
    };
  } catch (error) {
    console.error(
      "getGenerationHistory error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load generation history.",
    };
  }
}

export async function getGenerationById(
  id: string
): Promise<HistoryItemResponse> {
  const cleanId = id.trim();

  if (!cleanId) {
    return {
      success: false,
      error: "Generation ID is required.",
    };
  }

  try {
    const {
      data,
      error,
    } = await supabase
      .from("generation_history")
      .select("*")
      .eq("id", cleanId)
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
        error: "Generation history item not found.",
      };
    }

    const item = normalizeItem(data);

    if (!item) {
      return {
        success: false,
        error:
          "Generation history data is invalid.",
      };
    }

    return {
      success: true,
      data: item,
    };
  } catch (error) {
    console.error(
      "getGenerationById error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load generation.",
    };
  }
}

export async function deleteGeneration(
  id: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const cleanId = id.trim();

  if (!cleanId) {
    return {
      success: false,
      error: "Generation ID is required.",
    };
  }

  try {
    const {
      error,
    } = await supabase
      .from("generation_history")
      .delete()
      .eq("id", cleanId);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error(
      "deleteGeneration error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to delete generation.",
    };
  }
  }
