import { supabase } from "./supabase";

export interface VideoResponse {
  success: boolean;
  videoId?: string;
  status?: string;
  progress?: number;
  videoUrl?: string;
  error?: string;
}

const normalizeProgress = (
  value: unknown
): number => {
  if (typeof value !== "number") {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, value)
  );
};

export async function generateVideo(
  prompt: string
): Promise<VideoResponse> {
  try {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      return {
        success: false,
        error: "Prompt is required.",
      };
    }

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
      return {
        success: false,
        error: error.message,
      };
    }

    if (
      !data ||
      data.success !== true ||
      typeof data.videoId !==
        "string"
    ) {
      return {
        success: false,
        error:
          typeof data?.error ===
          "string"
            ? data.error
            : "Video generation could not be started.",
      };
    }

    return {
      success: true,
      videoId: data.videoId,
      status:
        typeof data.status ===
        "string"
          ? data.status
          : "queued",
      progress:
        normalizeProgress(
          data.progress
        ),
      videoUrl:
        typeof data.videoUrl ===
        "string"
          ? data.videoUrl
          : undefined,
    };
  } catch (error) {
    return {
      success: false,
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
  try {
    const cleanVideoId =
      videoId.trim();

    if (!cleanVideoId) {
      return {
        success: false,
        error:
          "Video ID is required.",
      };
    }

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
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: false,
        error:
          "Video status response is empty.",
      };
    }

    return {
      success:
        data.success === true,
      videoId:
        typeof data.videoId ===
        "string"
          ? data.videoId
          : cleanVideoId,
      status:
        typeof data.status ===
        "string"
          ? data.status
          : "unknown",
      progress:
        normalizeProgress(
          data.progress
        ),
      videoUrl:
        typeof data.videoUrl ===
        "string"
          ? data.videoUrl
          : undefined,
      error:
        typeof data.error ===
        "string"
          ? data.error
          : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve video status.",
    };
  }
}
