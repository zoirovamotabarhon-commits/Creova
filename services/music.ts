import { supabase } from "./supabase";

export interface MusicResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export const generateMusic = async (
  prompt: string
): Promise<MusicResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "music-generate",
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
      audioUrl: data?.audioUrl ?? "",
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
