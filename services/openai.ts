import { supabase } from "./supabase";
import { defaultPrompt } from "./prompt";
import { OPENAI_MODEL } from "./config";

export interface GenerateTextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export async function generateText(
  prompt: string
): Promise<GenerateTextResponse> {
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
            systemPrompt: defaultPrompt,
            model: OPENAI_MODEL,
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
          "AI server returned an empty response.",
      };
    }

    if (data.success !== true) {
      return {
        success: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "AI request failed.",
      };
    }

    if (
      typeof data.text !== "string" ||
      !data.text.trim()
    ) {
      return {
        success: false,
        error:
          "AI server returned an empty answer.",
      };
    }

    return {
      success: true,
      text: data.text,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "AI request failed.",
    };
  }
}
