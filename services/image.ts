import { supabase } from "./supabase";

export interface ImageResponse {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

export const generateImage = async (
  prompt: string
): Promise<ImageResponse> => {
  try {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      return {
        success: false,
        error: "Prompt is required.",
      };
    }

    const { data, error } = await supabase.functions.invoke(
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

    if (!data?.success) {
      return {
        success: false,
        error: data?.error ?? "Image generation failed.",
      };
    }

    let imageUrl = data.imageUrl ?? "";

    if (!imageUrl && data.imageBase64) {
      imageUrl = `data:image/png;base64,${data.imageBase64}`;
    }

    if (!imageUrl) {
      return {
        success: false,
        error: "Server did not return an image.",
      };
    }

    return {
      success: true,
      imageUrl,
      imageBase64: data.imageBase64,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    };
  }
};
