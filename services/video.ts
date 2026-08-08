import { supabase } from "./supabase";

export interface VideoResponse {
  success: boolean;
  videoId?: string;
  status?: string;
  error?: string;
}

export const generateVideo = async (
  prompt: string
): Promise<VideoResponse> => {
  try {
    if (!prompt.trim()) {
      return {
        success: false,
        error: "Prompt is required.",
      };
    }

    const { data, error } = await supabase.functions.invoke(
      "video-generate",
      {
        body: {
          prompt: prompt.trim(),
        },
      }
    );

    if (error) {
      throw error;
    }

    if (!data?.success) {
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
};
