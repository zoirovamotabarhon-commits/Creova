import {
  createGeneration,
} from "./generation";

export interface VoiceGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export async function generateVoice(
  prompt: string,
  coinCost = 3,
): Promise<VoiceGenerationResult> {
  if (!prompt.trim()) {
    return {
      success: false,
      error: "Voice prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "voice",
      coinCost,
      prompt,
      {
        feature: "voice",
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
        "Voice generation could not be created.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
  };
}
