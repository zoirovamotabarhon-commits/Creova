import { generateAIText } from "./ai";

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const sendMessage = async (
  message: string
): Promise<ChatResponse> => {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error: "Message is required.",
    };
  }

  try {
    const response = await generateAIText({
      prompt: cleanMessage,
      provider: "openai",
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error ?? "AI request failed.",
      };
    }

    return {
      success: true,
      message: response.text ?? "",
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
};
