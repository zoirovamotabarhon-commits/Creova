import { supabase } from "./supabase";
import {
  createGenerationRecord,
  updateGenerationRecord,
} from "./generation";

export interface ImageResponse {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  generationId?: string;
  error?: string;
}

export async function generateImage(
  prompt: string
): Promise<ImageResponse> {
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
      type: "image",
      prompt: cleanPrompt,
    });

    if (!record.success || !record.generationId) {
      return {
        success: false,
        error:
          record.error ??
          "Unable to start image generation.",
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
      "image-generate",
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
          : "Image generation failed.";

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

    const imageBase64 =
      typeof data.imageBase64 === "string"
        ? data.imageBase64.trim()
        : "";

    let imageUrl =
      typeof data.imageUrl === "string"
        ? data.imageUrl.trim()
        : "";

    if (!imageUrl && imageBase64) {
      imageUrl =
        `data:image/png;base64,${imageBase64}`;
    }

    if (!imageUrl) {
      const errorMessage =
        "Image server did not return an image.";

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
      resultUrl: imageUrl,
      provider: "openai",
    });

    return {
      success: true,
      imageUrl,
      imageBase64: imageBase64 || undefined,
      generationId,
    };
  } catch (error) {
    if (generationId) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Image generation failed.",
      });
    }

    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Image generation failed.",
    };
  }
}
