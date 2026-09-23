import { createGeneration } from "./generation";
import { invokeEdgeFunction } from "./edgeFunctions";

export interface VoiceResponse {
  success: boolean;
  generationId?: string;
  audioUrl?: string;
  error?: string;
}

export async function generateVoice(
  text: string,
): Promise<VoiceResponse> {
  const cleanText = text.trim();

  if (!cleanText) {
    return {
      success: false,
      error: "Voice text is required.",
    };
  }

  const generation =
    await createGeneration(
      "voice",
      undefined,
      cleanText,
      {
        feature: "voice",
      },
    );

  if (
    !generation.success ||
    !generation.generationId
  ) {
    return {
      success: false,
      error:
        generation.error ??
        "Voice generation could not be created.",
    };
  }

  const {
    data,
    error,
  } =
    await invokeEdgeFunction<{
      success: boolean;
      audioUrl?: string;
      audio_url?: string;
      error?: string;
    }>(
      "voice-generate",
      {
        body: {
          generationId:
            generation.generationId,
          text: cleanText,
        },
      },
    );

  if (error) {
    return {
      success: false,
      generationId:
        generation.generationId,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      generationId:
        generation.generationId,
      error:
        data?.error ??
        "Voice generation failed.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
    audioUrl:
      data.audioUrl ??
      data.audio_url,
  };
    }
