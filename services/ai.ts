import {
  generateText,
  type AIMessage,
} from "./openai";

export type {
  AIMessage,
  AIMessageRole,
} from "./openai";

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface GenerateAITextOptions {
  messages?: AIMessage[];
  systemPrompt?: string;
  model?: string;
}

export async function generateAIText(
  prompt: string,
  options: GenerateAITextOptions = {}
): Promise<AIResponse> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Prompt is required.",
    };
  }

  const history = (
    options.messages ?? []
  )
    .filter(
      (message) =>
        message &&
        (
          message.role === "user" ||
          message.role === "assistant" ||
          message.role === "system"
        ) &&
        typeof message.content ===
          "string" &&
        message.content.trim().length > 0
    )
    .slice(-40);

  const messages: AIMessage[] = [
    ...history,
    {
      role: "user",
      content: cleanPrompt,
    },
  ];

  try {
    const result =
      await generateText(
        messages,
        {
          systemPrompt:
            options.systemPrompt,
          model:
            options.model,
        }
      );

    if (!result.success) {
      return {
        success: false,
        error:
          result.error ??
          "AI request failed.",
      };
    }

    const text =
      result.text?.trim() ?? "";

    if (!text) {
      return {
        success: false,
        error:
          "AI returned an empty response.",
      };
    }

    return {
      success: true,
      text,
    };
  } catch (error) {
    console.error(
      "generateAIText error:",
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

export async function askAI(
  message: string,
  history: AIMessage[] = []
): Promise<AIResponse> {
  return generateAIText(
    message,
    {
      messages: history,
    }
  );
}
