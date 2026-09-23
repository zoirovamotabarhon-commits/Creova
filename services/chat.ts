import { createGeneration } from "./generation";
import { invokeEdgeFunction } from "./edgeFunctions";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResult {
  success: boolean;
  generationId?: string;
  message?: string;
  error?: string;
}

export type ChatResponse = ChatResult;

export async function generateChat(
  message: string,
  history: AIMessage[] = [],
): Promise<ChatResult> {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error: "Message is required.",
    };
  }

  const generation = await createGeneration(
    "chat",
    undefined,
    cleanMessage,
    {
      feature: "chat",
    },
  );

  if (!generation.success || !generation.generationId) {
    return {
      success: false,
      error:
        generation.error ??
        "Generation could not be created.",
    };
  }

  const messages: AIMessage[] = [
    ...history
      .filter(
        (item) =>
          item &&
          (item.role === "user" ||
            item.role === "assistant" ||
            item.role === "system") &&
          typeof item.content === "string" &&
          item.content.trim().length > 0,
      )
      .slice(-39),

    {
      role: "user",
      content: cleanMessage,
    },
  ];

  const { data, error } =
    await invokeEdgeFunction<{
      success: boolean;
      message?: string;
      text?: string;
      error?: string;
    }>("openai-chat", {
      body: {
        generationId: generation.generationId,

        // The edge function requires this exact field name.
        generationType: "chat",

        messages,
      },
    });

  if (error) {
    return {
      success: false,
      generationId: generation.generationId,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      generationId: generation.generationId,
      error:
        data?.error ??
        "AI request failed.",
    };
  }

  return {
    success: true,
    generationId: generation.generationId,
    message: data.message ?? data.text ?? "",
  };
}

export async function sendMessage(
  message: string,
  history: AIMessage[] = [],
): Promise<ChatResult> {
  return generateChat(message, history);
}
