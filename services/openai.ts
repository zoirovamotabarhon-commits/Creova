import { supabase } from "./supabase";

export interface OpenAIResponse {
  success: boolean;
  generationId?: string;
  message?: string;
  error?: string;
}

export async function generateOpenAIChat(
  message: string,
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

  const body: Record<
    string,
    unknown
  > = {
    message: cleanMessage,
  };

  if (generationId?.trim()) {
    body.generationId =
      generationId.trim();
  }

  const { data, error } =
    await supabase.functions.invoke(
      "openai-chat",
      {
        body,
      },
    );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      generationId:
        data?.generationId,
      error:
        data?.error ??
        "OpenAI request failed.",
    };
  }

  return {
    success: true,
    generationId:
      data.generationId,
    message:
      data.message ??
      data.content ??
      "",
  };
}

export async function chatWithOpenAI(
  message: string,
  generationId?: string,
): Promise<OpenAIResponse> {
  return generateOpenAIChat(
    message,
    generationId,
  );
}
