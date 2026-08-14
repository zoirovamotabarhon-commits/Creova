import {
  createGeneration,
} from "./generation";

export interface ImageGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export async function generateImage(
  prompt: string,
  coinCost = 5,
): Promise<ImageGenerationResult> {
  if (!prompt.trim()) {
    return {
      success: false,
      error: "Image prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "image",
      coinCost,
      prompt,
      {
        feature: "image",
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
        "Image generation could not be created.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
  };
}
