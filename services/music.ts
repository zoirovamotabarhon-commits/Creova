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
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      return {
        success: false,
        error: "Prompt is required.",
      };
    }

    const { data, error } = await supabase.functions.invoke(
      "music-generate",
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
        error:
          data?.error ??
          "Music generation failed.",
      };
    }

    if (
      typeof data.audioUrl !== "string" ||
      !data.audioUrl.trim()
    ) {
      return {
        success: false,
        error: "Music service did not return an audio URL.",
      };
    }

    return {
      success: true,
      audioUrl: data.audioUrl,
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
