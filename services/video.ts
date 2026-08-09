import { supabase } from "./supabase";

export interface VideoResponse {
  success: boolean;
  videoId?: string;
  status?: string;
  progress?: number;
  videoUrl?: string;
  error?: string | null;
}

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

    const { data, error } =
      await supabase.functions.invoke(
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
      !data?.success ||
      typeof data.videoId !== "string"
    ) {
      return {
        success: false,
        error:
          data?.error ??
          "Video generation could not be started.",
      };
    }

    return {
      success: true,
      videoId: data.videoId,
      status: data.status ?? "queued",
      progress:
        typeof data.progress === "number"
          ? data.progress
          : 0,
      videoUrl:
        typeof data.videoUrl === "string"
          ? data.videoUrl
          : undefined,
      error: null,
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
    const cleanVideoId = videoId.trim();

    if (!cleanVideoId) {
      return {
        success: false,
        error: "Video ID is required.",
      };
    }

    const { data, error } =
      await supabase.functions.invoke(
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

    if (!data?.success) {
      return {
        success: false,
        videoId:
          data?.videoId ?? cleanVideoId,
        status: data?.status,
        progress:
          typeof data?.progress === "number"
            ? data.progress
            : 0,
        error:
          data?.error ??
          "Unable to retrieve video status.",
      };
    }

    return {
      success: true,
      videoId:
        data.videoId ?? cleanVideoId,
      status: data.status ?? "unknown",
      progress:
        typeof data.progress === "number"
          ? data.progress
          : 0,
      videoUrl:
        typeof data.videoUrl === "string"
          ? data.videoUrl
          : undefined,
      error: null,
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
