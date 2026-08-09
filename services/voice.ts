import { supabase } from "./supabase";

export interface VoiceResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export const generateVoice = async (
  text: string
): Promise<VoiceResponse> => {
  try {
    const cleanText = text.trim();

    if (!cleanText) {
      return {
        success: false,
        error: "Text is required.",
      };
    }

    const { data, error } =
      await supabase.functions.invoke(
        "voice-generate",
        {
          body: {
            text: cleanText,
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
          "Voice generation failed.",
      };
    }

    if (
      typeof data.audioUrl !== "string" ||
      !data.audioUrl.trim()
    ) {
      return {
        success: false,
        error:
          "Voice service did not return an audio URL.",
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
