import {
  createGeneration,
  GenerationResult,
} from "./generation";

export interface ChatResult {
  success: boolean;
  generationId?: string;
  message?: string;
  error?: string;
}

export async function generateChat(
  message: string,
  coinCost = 1,
): Promise<ChatResult> {
  if (!message.trim()) {
    return {
      success: false,
      error: "Message is required.",
    };
  }

  const generation =
    await createGeneration(
      "chat",
      coinCost,
      message,
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

  return {
    success: true,
    generationId:
      generation.generationId,
  };
}

export async function sendMessage(
  message: string,
  coinCost = 1,
): Promise<ChatResult> {
  return generateChat(
    message,
    coinCost,
  );
}
