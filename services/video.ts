import { invokeEdgeFunction } from "./edgeFunctions";
import {
  createGeneration,
  getGeneration,
} from "./generation";

export interface VideoResponse {
  success: boolean;
  generationId?: string;
  videoId?: string;
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
      undefined,
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

  const {
    data,
    error,
  } =
    await invokeEdgeFunction<{
      success: boolean;
      videoId?: string;
      videoUrl?: string;
      status?: string;
      progress?: unknown;
      error?: string;
    }>(
      "video-generate",
      {
        body: {
          action: "create",
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

  if (
    !data?.success ||
    !data.videoId
  ) {
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
    videoId:
      data.videoId,
    videoUrl:
      data.videoUrl,
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
  videoId?: string,
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

  const metadata =
    generation.data.metadata ??
    {};

  const currentVideoId =
    videoId ??
    (
      typeof metadata.videoId ===
      "string"
        ? metadata.videoId
        : undefined
    );

  if (!currentVideoId) {
    return {
      success: false,
      generationId,
      error:
        "Video ID is missing.",
    };
  }

  const {
    data,
    error,
  } =
    await invokeEdgeFunction<{
      success: boolean;
      videoUrl?: string;
      status?: string;
      progress?: unknown;
      error?: string;
    }>(
      "video-generate",
      {
        body: {
          action: "status",
          generationId,
          videoId:
            currentVideoId,
        },
      },
    );

  if (error) {
    return {
      success: false,
      generationId,
      videoId:
        currentVideoId,
      error: error.message,
    };
  }

  return {
    success:
      Boolean(data?.success),
    generationId,
    videoId:
      currentVideoId,
    videoUrl:
      data?.videoUrl,
    status:
      data?.status ??
      generation.data.status,
    progress:
      normalizeProgress(
        data?.progress,
      ),
    error:
      data?.error,
  };
}
