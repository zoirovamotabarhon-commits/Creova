import {
  generateAIText,
  type AIMessage,
} from "./ai";
import {
  createGenerationRecord,
  updateGenerationRecord,
} from "./generation";

export interface ChatResponse {
  success: boolean;
  message?: string;
  generationId?: string;
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

  let generationId: string | undefined;

  try {
    const record = await createGenerationRecord({
      type: "chat",
      prompt: cleanMessage,
      metadata: {
        historyMessages: cleanHistory.length,
      },
    });

    if (!record.success || !record.generationId) {
      return {
        success: false,
        error:
          record.error ??
          "Unable to start chat generation.",
      };
    }

    generationId = record.generationId;

    await updateGenerationRecord(generationId, {
      status: "processing",
    });

    const response = await generateAIText(
      cleanMessage,
      {
        messages: cleanHistory,
        systemPrompt:
          "You are CREOVA AI Assistant. Answer clearly, accurately and helpfully.",
      }
    );

    if (!response.success) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage:
          response.error ?? "AI request failed.",
      });

      return {
        success: false,
        generationId,
        error:
          response.error ?? "AI request failed.",
      };
    }

    const text = response.text?.trim() ?? "";

    if (!text) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage: "AI returned an empty response.",
      });

      return {
        success: false,
        generationId,
        error: "AI returned an empty response.",
      };
    }

    await updateGenerationRecord(generationId, {
      status: "completed",
      resultText: text,
      provider: "openai",
    });

    return {
      success: true,
      message: text,
      generationId,
    };
  } catch (error) {
    if (generationId) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unexpected chat error.",
      });
    }

    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected chat error.",
    };
  }
}
