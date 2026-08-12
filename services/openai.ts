import { supabase } from "./supabase";
import { OPENAI_MODEL } from "./config";

export type AIMessageRole =
  | "user"
  | "assistant"
  | "system";

export interface AIMessage {
  role: AIMessageRole;
  content: string;
}

export interface GenerateTextOptions {
  systemPrompt?: string;
  model?: string;
}

export interface GenerateTextResult {
  success: boolean;
  text?: string;
  error?: string;
}

export async function generateText(
  messages: AIMessage[],
  options: GenerateTextOptions = {}
): Promise<GenerateTextResult> {
  const cleanMessages = messages
    .filter(
      (message) =>
        message &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));

  if (cleanMessages.length === 0) {
    return {
      success: false,
      error: "At least one message is required.",
    };
  }

  const systemPrompt =
    options.systemPrompt?.trim() ||
    "You are CREOVA AI Assistant. Give clear, useful and accurate answers.";

  const model =
    options.model?.trim() || OPENAI_MODEL;

  try {
    const { data, error } =
      await supabase.functions.invoke(
        "openai-chat",
        {
          body: {
            messages: cleanMessages,
            systemPrompt,
            model,
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

    if (data.success !== true) {
      return {
        success: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "AI service returned an error.",
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
