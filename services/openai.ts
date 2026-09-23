import { invokeEdgeFunction } from "./edgeFunctions";
import type {
  AIMessage,
} from "./chat";

/**
 * NOTE: this module is legacy/unused by the current UI (no
 * screen or hook calls generateOpenAIChat/chatWithOpenAI - only
 * services/index.ts re-exports it). Unlike chat.ts, it does not
 * call createGeneration() itself and expects an already-created
 * generationId to be passed in. Kept working and consistent with
 * the openai-chat contract in case something still imports it
 * directly, but prefer services/chat.ts for new code.
 */

export interface OpenAIResponse {
  success: boolean;
  generationId?: string;
  message?: string;
  error?: string;
}

export async function generateOpenAIChat(
  message: string,
  history: AIMessage[] = [],
  generationId?: string,
): Promise<OpenAIResponse> {
  const cleanMessage =
    message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error:
        "Message is required.",
    };
  }

  const messages: AIMessage[] = [
    ...history.slice(-39),
    {
      role: "user",
      content: cleanMessage,
    },
  ];

  const {
    data,
    error,
  } =
    await invokeEdgeFunction<{
      success: boolean;
      generationId?: string;
      text?: string;
      message?: string;
      error?: string;
    }>(
      "openai-chat",
      {
        body: {
          generationId,

          // NOTE: openai-chat requires generationType (without it,
          // it immediately rejects the request with "Invalid
          // generation type.") - this was previously missing here.
          generationType:
            "chat",

          messages,
        },
      },
    );

  if (error) {
    return {
      success: false,
      generationId,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      generationId:
        data?.generationId ??
        generationId,
      error:
        data?.error ??
        "OpenAI request failed.",
    };
  }

  return {
    success: true,
    generationId:
      data.generationId ??
      generationId,
    message:
      data.text ??
      data.message ??
      "",
  };
}

export async function chatWithOpenAI(
  message: string,
  history: AIMessage[] = [],
  generationId?: string,
): Promise<OpenAIResponse> {
  return generateOpenAIChat(
    message,
    history,
    generationId,
  );
    }
