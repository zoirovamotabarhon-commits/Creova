import { supabase } from "./supabase";
import { getFeatureCost } from "./featureCosts";

export type GenerationType =
  | "chat"
  | "code"
  | "image"
  | "music"
  | "video"
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

export async function createGeneration(
  type: GenerationType,
  _coinCost?: number,
  prompt?: string,
  metadata: Record<string, unknown> = {},
): Promise<GenerationResult<GenerationRecord>> {
  const cleanPrompt = prompt?.trim() ?? "";

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Prompt is required.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const generationId = crypto.randomUUID();
  const coinCost = getFeatureCost(type);

  const { data, error } =
    await supabase.functions.invoke(
      "generation-record",
      {
        body: {
          generationId,
          type,
          prompt: cleanPrompt,
          metadata: {
            ...metadata,
            coinCost,
          },
        },
      },
    );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success || !data.generationId) {
    return {
      success: false,
      error:
        data?.error ??
        "Generation could not be created.",
    };
  }

  return {
    success: true,
    generationId: data.generationId,
    data: data.generation,
  };
}

export async function getGeneration(
  generationId: string,
): Promise<GenerationResult<GenerationRecord>> {
  const id = generationId.trim();

  if (!id) {
    return {
      success: false,
      error: "Generation ID is required.",
    };
  }

  const { data, error } = await supabase
    .from("generation_history")
    .select("*")
    .eq("id", id)
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
      error: "Generation not found.",
    };
  }

  const metadata =
    data.metadata &&
    typeof data.metadata === "object" &&
    !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};

  return {
    success: true,
    data: {
      id: data.id,
      userId: data.user_id,
      type: data.type,
      status: data.status,
      coinCost: Number(
        metadata.coinCost ??
          getFeatureCost(
            data.type as GenerationType,
          ),
      ),
      prompt: data.prompt,
      metadata,
      resultText: data.result_text,
      resultUrl: data.result_url,
      provider: data.provider,
      model: data.model,
      errorMessage: data.error_message,
      createdAt: data.created_at,
      startedAt: data.started_at,
      completedAt: data.completed_at,
    },
  };
  }
