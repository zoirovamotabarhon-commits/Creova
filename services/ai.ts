import {
  generateText,
  type ChatMessage,
} from "./openai";

export interface AIResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export async function askAI(
  message: string,
  history: ChatMessage[] = []
): Promise<AIResponse> {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error: "Message is required.",
    };
  }

  try {
    const messages: ChatMessage[] = [
      ...history,
      {
        role: "user",
        content: cleanMessage,
      },
    ];

    const result =
      await generateText(messages);

    if (!result.success) {
      return {
        success: false,
        error:
          result.error ??
          "AI request failed.",
      };
    }

    const text =
      typeof result.text === "string"
        ? result.text.trim()
        : "";

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
      "askAI error:",
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
