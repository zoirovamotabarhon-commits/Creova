import {
  createGeneration,
} from "./generation";

export interface MusicGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export async function generateMusic(
  prompt: string,
  coinCost = 8,
): Promise<MusicGenerationResult> {
  if (!prompt.trim()) {
    return {
      success: false,
      error: "Music prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "music",
      coinCost,
      prompt,
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
