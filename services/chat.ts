import {
  generateAIText,
  AIMessage,
} from "./ai";

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const MAX_HISTORY_MESSAGES = 40;

export async function sendMessage(
  message: string,
  history: AIMessage[] = []
): Promise<ChatResponse> {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error: "Message is required.",
    };
  }

  const cleanHistory = history
    .filter(
      (item) =>
        item &&
        (item.role === "user" ||
          item.role === "assistant" ||
          item.role === "system") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES);

  try {
    const response =
      await generateAIText(
        cleanMessage,
        {
          messages: cleanHistory,
          systemPrompt:
            "You are CREOVA AI Assistant. Continue the conversation naturally. Remember the recent conversation context and answer clearly, accurately and helpfully.",
        }
      );

    if (!response.success) {
      return {
        success: false,
        error:
          response.message ||
          "AI request failed.",
      };
    }

    const text =
      typeof response.data === "string"
        ? response.data.trim()
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
      message: text,
    };
  } catch (error) {
    console.error(
      "sendMessage error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected chat error.",
    };
  }
}
