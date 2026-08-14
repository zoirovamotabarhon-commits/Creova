import {
  createGeneration,
} from "./generation";

export interface MusicGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export type MusicResponse =
  MusicGenerationResult;

export async function generateMusic(
  prompt: string,
  coinCost?: number,
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
      coinCost,
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

  return {
    success: true,
    generationId:
      generation.generationId,
  };
}
