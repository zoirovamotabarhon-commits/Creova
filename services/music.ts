import { supabase } from "./supabase";
import {
  createGenerationRecord,
  updateGenerationRecord,
} from "./generation";

export interface MusicResponse {
  success: boolean;
  audioUrl?: string;
  generationId?: string;
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

  let generationId: string | undefined;

  try {
    const record = await createGenerationRecord({
      type: "music",
      prompt: cleanPrompt,
    });

    if (!record.success || !record.generationId) {
      return {
        success: false,
        error:
          record.error ??
          "Unable to start music generation.",
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
      "music-generate",
      {
        body: {
          prompt: cleanPrompt,
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
          : "Music generation failed.";

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
        "Music server did not return an audio URL.";

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
      provider: "elevenlabs",
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
            : "Music generation failed.",
      });
    }

    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Music generation failed.",
    };
  }
}
