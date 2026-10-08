import {
  createGeneration,
} from "./generation";

import {
  invokeEdgeFunction,
} from "./edgeFunctions";

export interface AIMessage {
  role:
    | "user"
    | "assistant"
    | "system";

  content: string;
}

export interface ChatResult {
  success: boolean;

  generationId?: string;

  message?: string;

  error?: string;

  model?: string;

  conversationId?: string;
}

export type ChatResponse =
  ChatResult;

export async function generateChat(
  message: string,
  history: AIMessage[] = [],
  conversationId?: string,
): Promise<ChatResult> {
  const cleanMessage =
    message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error:
        "Message is required.",
    };
  }

  const generation =
    await createGeneration(
      "chat",
      undefined,
      cleanMessage,
      {
        feature: "chat",
      },
    );

  if (
    !generation.success ||
    !generation.generationId
  ) {
    return {
      success: false,
      error:
        generation.error ??
        "Generation could not be created.",
    };
  }

  /*
   * The server is responsible for
   * persistent Chat History.
   *
   * We still send history for backward
   * compatibility with the current
   * Edge Function during migration.
   */
  const messages: AIMessage[] = [
    ...history
      .filter(
        (item) =>
          item &&
          (
            item.role ===
              "user" ||
            item.role ===
              "assistant" ||
            item.role ===
              "system"
          ) &&
          typeof item.content ===
            "string" &&
          item.content
            .trim()
            .length > 0,
      )
      .slice(-39),

    {
      role: "user",
      content:
        cleanMessage,
    },
  ];

  const {
    data,
    error,
  } =
    await invokeEdgeFunction<{
      success: boolean;

      message?: string;

      text?: string;

      error?: string;

      model?: string;

      conversationId?: string;
    }>(
      "gemini-chat",
      {
        body: {
          generationId:
            generation.generationId,

          generationType:
            "chat",

          messages,

          conversationId,
        },
      },
    );

  if (error) {
    return {
      success: false,

      generationId:
        generation.generationId,

      error:
        error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,

      generationId:
        generation.generationId,

      error:
        data?.error ??
        "AI request failed.",
    };
  }

  return {
    success: true,

    generationId:
      generation.generationId,

    message:
      data.message ??
      data.text ??
      "",

    model:
      data.model,

    conversationId:
      data.conversationId ??
      conversationId,
  };
}

export async function sendMessage(
  message: string,
  history: AIMessage[] = [],
  conversationId?: string,
): Promise<ChatResult> {
  return generateChat(
    message,
    history,
    conversationId,
  );
          }
