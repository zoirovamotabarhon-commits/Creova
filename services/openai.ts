import { supabase } from "./supabase";
import { OPENAI_MODEL } from "./config";

export interface GenerateTextResult {
  success: boolean;
  text?: string;
  error?: string;
}

export async function generateText(
  prompt: string
): Promise<GenerateTextResult> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
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
            prompt: cleanPrompt,
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
        error:
          "Empty response from AI service.",
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

    const text =
      typeof data.text === "string"
        ? data.text.trim()
        : "";

    if (!text) {
      return {
        success: false,
        error:
          "AI service returned empty text.",
      };
    }

    return {
      success: true,
      text,
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
