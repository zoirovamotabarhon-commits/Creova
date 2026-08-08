import { supabase } from "./supabase";

export interface VideoResponse {
  success: boolean;
  videoId?: string;
  status?: string;
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
}
