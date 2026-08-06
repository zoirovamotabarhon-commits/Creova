import { supabase } from "./supabase";

export interface ImageResponse {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export const generateImage = async (
  prompt: string
): Promise<ImageResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "image-generate",
      {
        body: {
          prompt,
        },
      }
    );

    if (error) {
      throw error;
    }

    return {
      success: true,
      imageUrl: data?.imageUrl ?? "",
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
