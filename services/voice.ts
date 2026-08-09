import { supabase } from "./supabase";

export interface VoiceResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export async function generateVoice(
  text: string
): Promise<VoiceResponse> {
  const cleanText = text.trim();

  if (!cleanText) {
    return {
      success: false,
      error: "Text is required.",
    };
  }

  try {
    const {
      data,
      error,
    } = await supabase.functions.invoke(
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

    if (!data) {
      return {
        success: false,
        error:
          "Voice server returned an empty response.",
      };
    }

    if (data.success !== true) {
      return {
        success: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "Voice generation failed.",
      };
    }

    if (
      typeof data.audioUrl !== "string" ||
      !data.audioUrl.trim()
    ) {
      return {
        success: false,
        error:
          "Voice server did not return an audio URL.",
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
          : "Voice generation failed.",
    };
  }
}
