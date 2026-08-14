import { createGeneration } from "./generation";
import { supabase } from "./supabase";

export interface ImageGenerationResult {
  success: boolean;
  generationId?: string;
  imageUrl?: string;
  error?: string;
}

export type ImageResponse =
  ImageGenerationResult;

export async function generateImage(
  prompt: string,
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
      undefined,
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

  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "image-generate",
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
        "Image generation failed.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
    imageUrl:
      data.imageUrl ??
      data.image_url,
  };
}
