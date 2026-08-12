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

const normalizeStatus = (
  value: unknown
): string => {
  if (typeof value !== "string") {
    return "unknown";
  }

  return value.trim() || "unknown";
};

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

  try {
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

    if (!data) {
      return {
        success: false,
        error:
          "Video server returned an empty response.",
      };
    }

    if (
      data.success !== true ||
      typeof data.videoId !== "string" ||
      !data.videoId.trim()
    ) {
      return {
        success: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "Video generation could not be started.",
      };
    }

    return {
      success: true,
      videoId: data.videoId.trim(),
      status: normalizeStatus(
        data.status
      ),
      progress:
        normalizeProgress(
          data.progress
        ),
      videoUrl:
        typeof data.videoUrl === "string" &&
        data.videoUrl.trim()
          ? data.videoUrl.trim()
          : undefined,
    };
  } catch (error) {
    console.error(
      "generateVideo error:",
      error
    );

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
  const cleanVideoId =
    videoId.trim();

  if (!cleanVideoId) {
    return {
      success: false,
      error: "Video ID is required.",
    };
  }

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

    const status =
      normalizeStatus(data.status);

    return {
      success:
        data.success === true,
      videoId:
        typeof data.videoId === "string" &&
        data.videoId.trim()
          ? data.videoId.trim()
          : cleanVideoId,
      status,
      progress:
        normalizeProgress(
          data.progress
        ),
      videoUrl:
        typeof data.videoUrl === "string" &&
        data.videoUrl.trim()
          ? data.videoUrl.trim()
          : undefined,
      error:
        typeof data.error === "string"
          ? data.error
          : undefined,
    };
  } catch (error) {
    console.error(
      "getVideoStatus error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to retrieve video status.",
    };
  }
}
