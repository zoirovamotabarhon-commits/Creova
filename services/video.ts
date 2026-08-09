import { supabase } from "./supabase";

export interface VideoResponse {
  success: boolean;
  videoId?: string;
  status?: string;
  videoUrl?: string;
  error?: string;
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

    const { data, error } = await supabase.functions.invoke(
      "video-generate",
      {
        body: {
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

    if (!data?.success || !data?.videoId) {
      return {
        success: false,
        error: data?.error ?? "Video generation failed.",
      };
    }

    return {
      success: true,
      videoId: data.videoId,
      status: data.status,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    };
  }
}

export async function getVideoStatus(
  videoId: string
): Promise<VideoResponse> {
  try {
    if (!videoId.trim()) {
      return {
        success: false,
        error: "Video ID is required.",
      };
    }

    const { data, error } = await supabase.functions.invoke(
      "video-status",
      {
        body: {
          videoId: videoId.trim(),
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
        error: data?.error ?? "Could not get video status.",
      };
    }

    return {
      success: true,
      videoId: data.videoId,
      status: data.status,
      videoUrl: data.videoUrl,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    };
  }
}
