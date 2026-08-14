import { supabase } from "./supabase";
import {
  createGenerationRecord,
  updateGenerationRecord,
} from "./generation";

export interface VideoResponse {
  success: boolean;
  videoId?: string;
  generationId?: string;
  status?: string;
  progress?: number;
  videoUrl?: string;
  error?: string;
}

const POLLING_GENERATIONS =
  new Map<string, string>();

function normalizeProgress(
  value: unknown
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, value)
  );
}

function normalizeStatus(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "unknown";
  }

  return value.trim() || "unknown";
}

export async function generateVideo(
  prompt: string
): Promise<VideoResponse> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Prompt is required.",
    };
  }

  let generationId: string | undefined;

  try {
    const record = await createGenerationRecord({
      type: "video",
      prompt: cleanPrompt,
    });

    if (!record.success || !record.generationId) {
      return {
        success: false,
        error:
          record.error ??
          "Unable to start video generation.",
      };
    }

    generationId = record.generationId;

    await updateGenerationRecord(generationId, {
      status: "processing",
    });

    const {
      data,
      error,
    } = await supabase.functions.invoke(
      "video-generate",
      {
        body: {
          action: "create",
          prompt: cleanPrompt,
        },
      }
    );

    if (error) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage: error.message,
      });

      return {
        success: false,
        generationId,
        error: error.message,
      };
    }

    if (
      !data ||
      data.success !== true ||
      typeof data.videoId !== "string" ||
      !data.videoId.trim()
    ) {
      const errorMessage =
        typeof data?.error === "string"
          ? data.error
          : "Video generation could not be started.";

      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage,
      });

      return {
        success: false,
        generationId,
        error: errorMessage,
      };
    }

    const videoId =
      data.videoId.trim();

    POLLING_GENERATIONS.set(
      videoId,
      generationId
    );

    return {
      success: true,
      videoId,
      generationId,
      status: normalizeStatus(data.status),
      progress: normalizeProgress(data.progress),
      videoUrl:
        typeof data.videoUrl === "string"
          ? data.videoUrl.trim() || undefined
          : undefined,
    };
  } catch (error) {
    if (generationId) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Video generation failed.",
      });
    }

    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Video generation failed.",
    };
  }
}

export async function getVideoStatus(
  videoId: string
): Promise<VideoResponse> {
  const cleanVideoId = videoId.trim();

  if (!cleanVideoId) {
    return {
      success: false,
      error: "Video ID is required.",
    };
  }

  const generationId =
    POLLING_GENERATIONS.get(cleanVideoId);

  try {
    const {
      data,
      error,
    } = await supabase.functions.invoke(
      "video-generate",
      {
        body: {
          action: "status",
          videoId: cleanVideoId,
        },
      }
    );

    if (error) {
      return {
        success: false,
        generationId,
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: false,
        generationId,
        error:
          "Video status response is empty.",
      };
    }

    const status =
      normalizeStatus(data.status);

    const videoUrl =
      typeof data.videoUrl === "string"
        ? data.videoUrl.trim() || undefined
        : undefined;

    if (
      generationId &&
      status === "completed"
    ) {
      await updateGenerationRecord(
        generationId,
        {
          status: "completed",
          resultUrl: videoUrl,
          provider: "openai",
        }
      );

      POLLING_GENERATIONS.delete(
        cleanVideoId
      );
    }

    if (
      generationId &&
      (status === "failed" ||
        status === "cancelled")
    ) {
      await updateGenerationRecord(
        generationId,
        {
          status:
            status === "cancelled"
              ? "cancelled"
              : "failed",
          errorMessage:
            typeof data.error === "string"
              ? data.error
              : `Video status: ${status}`,
        }
      );

      POLLING_GENERATIONS.delete(
        cleanVideoId
      );
    }

    return {
      success: data.success === true,
      videoId: cleanVideoId,
      generationId,
      status,
      progress: normalizeProgress(
        data.progress
      ),
      videoUrl,
      error:
        typeof data.error === "string"
          ? data.error
          : undefined,
    };
  } catch (error) {
    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve video status.",
    };
  }
}
