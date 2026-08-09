import { supabase } from "./supabase";

export interface MusicResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export async function generateMusic(
  prompt: string
): Promise<MusicResponse> {
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

    if (!data) {
      return {
        success: false,
        error:
          "Music server returned an empty response.",
      };
    }

    if (data.success !== true) {
      return {
        success: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "Music generation failed.",
      };
    }

    if (
      typeof data.audioUrl !== "string" ||
      !data.audioUrl.trim()
    ) {
      return {
        success: false,
        error:
          "Music server did not return an audio URL.",
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
          : "Music generation failed.",
    };
  }
}
