import {
  createGeneration,
} from "./generation";

export interface VideoGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export async function generateVideo(
  prompt: string,
  coinCost = 15,
): Promise<VideoGenerationResult> {
  if (!prompt.trim()) {
    return {
      success: false,
      error: "Video prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "video",
      coinCost,
      prompt,
      {
        feature: "video",
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
        "Video generation could not be created.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
  };
}
