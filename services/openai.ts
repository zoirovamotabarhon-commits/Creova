import { supabase } from "./supabase";
import { OPENAI_MODEL } from "./config";

export interface GenerateTextResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function generateText(
  prompt: string
): Promise<GenerateTextResult> {
  if (!prompt || !prompt.trim()) {
    return {
      success: false,
      error: "Prompt is required.",
    };
  }

  try {
    const { data, error } =
      await supabase.functions.invoke(
        "openai-chat",
        {
          body: {
            prompt: prompt.trim(),
            model: OPENAI_MODEL,
          },
        }
      );

    if (error) {
      console.error(
        "openai-chat error:",
        error
      );

      return {
        success: false,
        error:
          error.message ||
          "AI request failed.",
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Empty response from AI service.",
      };
    }

    if (data.success === false) {
      return {
        success: false,
        error:
          data.error ||
          "AI service returned an error.",
      };
    }

    return {
      success: true,
      message:
        data.message ||
        data.text ||
        data.content ||
        "",
    };
  } catch (error) {
    console.error(
      "generateText error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected AI error.",
    };
  }
}
