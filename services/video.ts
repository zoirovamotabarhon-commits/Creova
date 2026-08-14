import { supabase } from "./supabase";
import {
  createGeneration,
  getGeneration,
} from "./generation";

export interface VideoResponse {
  success: boolean;
  generationId?: string;
  videoUrl?: string;
  status?: string;
  progress?: number;
  error?: string;
}

function normalizeProgress(
  value: unknown,
): number {
  const progress =
    typeof value === "number"
      ? value
      : Number(value);

  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, progress),
  );
}

export async function generateVideo(
  prompt: string,
  coinCost?: number,
): Promise<VideoResponse> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Video prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "video",
      coinCost,
      cleanPrompt,
      {
        feature: "video",
      },
    );

  if (
    !generation.success ||
    !generation.generationId
  ) {
    return {
      success: false,
      error:
        generation.error ??
        "Video generation could not be created.",
    };
  }

  const { data, error } =
    await supabase.functions.invoke(
      "video-generate",
      {
        body: {
          generationId:
            generation.generationId,
          prompt: cleanPrompt,
        },
      },
    );

  if (error) {
    return {
      success: false,
      generationId:
        generation.generationId,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      generationId:
        generation.generationId,
      error:
        data?.error ??
        "Video generation failed.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
    videoUrl:
      data.videoUrl ??
      data.video_url ??
      undefined,
    status:
      data.status ??
      "queued",
    progress:
      normalizeProgress(
        data.progress,
      ),
  };
}

export async function getVideoStatus(
  generationId: string,
): Promise<VideoResponse> {
  const generation =
    await getGeneration(
      generationId,
    );

  if (
    !generation.success ||
    !generation.data
  ) {
    return {
      success: false,
      generationId,
      error:
        generation.error ??
        "Video generation not found.",
    };
  }

  const data =
    generation.data;

  return {
    success: true,
    generationId:
      data.id,
    videoUrl:
      data.resultUrl ??
      undefined,
    status:
      data.status,
    progress:
      data.status === "completed"
        ? 100
        : data.status ===
            "processing"
          ? 50
          : 0,
    error:
      data.errorMessage ??
      undefined,
  };
}
