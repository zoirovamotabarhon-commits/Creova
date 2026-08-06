import { generateAIText } from "./ai";

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const sendMessage = async (
  message: string
): Promise<ChatResponse> => {
  try {
    const response = await generateAIText({
      prompt: message,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error ?? "Unknown error",
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
          : "Unknown error",
    };
  }
};
