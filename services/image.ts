import {
  createGeneration,
} from "./generation";

export interface ImageGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export type ImageResponse =
  ImageGenerationResult;

export async function generateImage(
  prompt: string,
  coinCost?: number,
): Promise<ImageGenerationResult> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Image prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "image",
      coinCost,
      cleanPrompt,
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
