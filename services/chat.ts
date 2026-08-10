import { generateAIText } from "./ai";

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function sendMessage(
  message: string
): Promise<ChatResponse> {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error: "Message is required.",
    };
  }

  try {
    const response =
      await generateAIText({
        prompt: cleanMessage,
      });

    if (!response.success) {
      return {
        success: false,
        error:
          response.error ??
          "AI request failed.",
      };
    }

    return {
      success: true,
      message:
        response.message ?? "",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected chat error.",
    };
  }
}
