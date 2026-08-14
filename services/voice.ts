import { supabase } from "./supabase";
import {
  createGenerationRecord,
  updateGenerationRecord,
} from "./generation";

export interface VoiceResponse {
  success: boolean;
  audioUrl?: string;
  generationId?: string;
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

  let generationId: string | undefined;

  try {
    const record = await createGenerationRecord({
      type: "voice",
      prompt: cleanText,
    });

    if (!record.success || !record.generationId) {
      return {
        success: false,
        error:
          record.error ??
          "Unable to start voice generation.",
      };
    }

    generationId = record.generationId;

    await updateGenerationRecord(generationId, {
      status: "processing",
    });

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
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage: error.message,
      });

      return {
        success: false,
        generationId,
        error: error.message,
      };
    }

    if (!data || data.success !== true) {
      const errorMessage =
        typeof data?.error === "string"
          ? data.error
          : "Voice generation failed.";

      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage,
      });

      return {
        success: false,
        generationId,
        error: errorMessage,
      };
    }

    const audioUrl =
      typeof data.audioUrl === "string"
        ? data.audioUrl.trim()
        : "";

    if (!audioUrl) {
      const errorMessage =
        "Voice server did not return an audio URL.";

      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage,
      });

      return {
        success: false,
        generationId,
        error: errorMessage,
      };
    }

    await updateGenerationRecord(generationId, {
      status: "completed",
      resultUrl: audioUrl,
      provider: "openai",
    });

    return {
      success: true,
      audioUrl,
      generationId,
    };
  } catch (error) {
    if (generationId) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Voice generation failed.",
      });
    }

    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Voice generation failed.",
    };
  }
}
