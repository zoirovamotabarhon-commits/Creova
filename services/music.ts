import { createGeneration } from "./generation";
import { supabase } from "./supabase";

export interface MusicGenerationResult {
  success: boolean;
  generationId?: string;
  audioUrl?: string;
  error?: string;
}

export type MusicResponse =
  MusicGenerationResult;

export async function generateMusic(
  prompt: string,
): Promise<MusicGenerationResult> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Music prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "music",
      undefined,
      cleanPrompt,
      {
        feature: "music",
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
        "Music generation could not be created.",
    };
  }

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "music-generate",
      {
        body: {
          generationId:
            generation.generationId,
          prompt: cleanPrompt,
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
        "Music generation failed.",
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
