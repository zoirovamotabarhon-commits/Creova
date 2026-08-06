import { supabase } from "./supabase";

export interface VideoResponse {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

export const generateVideo = async (
  prompt: string
): Promise<VideoResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "video-generate",
      {
        body: {
          prompt,
        },
      }
    );

    if (error) {
      throw error;
    }

    return {
      success: true,
      videoUrl: data?.videoUrl ?? "",
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
