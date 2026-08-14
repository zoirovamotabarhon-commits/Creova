import { supabase } from "./supabase";
import type {
  AIMessage,
} from "./chat";

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
    await supabase.functions.invoke(
      "openai-chat",
      {
        body: {
          generationId,
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
