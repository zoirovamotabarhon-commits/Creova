import { supabase } from "./supabase";
import {
  createGeneration,
} from "./generation";

export interface VoiceResponse {
  success: boolean;
  generationId?: string;
  audioUrl?: string;
  error?: string;
}

export async function generateVoice(
  text: string,
  coinCost?: number,
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
      coinCost,
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

  const { data, error } =
    await supabase.functions.invoke(
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
      data.audio_url ??
      undefined,
  };
}
