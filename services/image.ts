import { supabase } from "./supabase";

export interface ImageResponse {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
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

  try {
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
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: false,
        error:
          "Image server returned an empty response.",
      };
    }

    if (data.success !== true) {
      return {
        success: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "Image generation failed.",
      };
    }

    let imageUrl =
      typeof data.imageUrl === "string"
        ? data.imageUrl.trim()
        : "";

    const imageBase64 =
      typeof data.imageBase64 ===
      "string"
        ? data.imageBase64.trim()
        : "";

    if (!imageUrl && imageBase64) {
      imageUrl =
        `data:image/png;base64,${imageBase64}`;
    }

    if (!imageUrl) {
      return {
        success: false,
        error:
          "Image server did not return an image.",
      };
    }

    return {
      success: true,
      imageUrl,
      imageBase64:
        imageBase64 || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Image generation failed.",
    };
  }
}
