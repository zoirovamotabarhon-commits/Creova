import { generateText } from "./openai";

export interface AIResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateTextOptions {
  messages?: AIMessage[];
  systemPrompt?: string;
  model?: string;
}

export async function generateAIText(
  prompt: string,
  options: GenerateTextOptions = {}
): Promise<AIResponse> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      message: "Prompt is required.",
    };
  }

  try {
    const messages: AIMessage[] = [
      ...(options.messages ?? []),
      {
        role: "user",
        content: cleanPrompt,
      },
    ];

    const result = await generateText(
      messages,
      {
        systemPrompt:
          options.systemPrompt ??
          "You are CREOVA AI Assistant. Give clear, useful and accurate answers.",
        model: options.model,
      }
    );

    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }

    return {
      success: true,
      message: "AI response generated successfully.",
      data: result.data,
    };
  } catch (error) {
    console.error("AI service error:", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "AI request failed.",
    };
  }
}
