import {
  createGeneration,
} from "./generation";

export interface CodeGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export async function generateCode(
  prompt: string,
  coinCost = 1,
): Promise<CodeGenerationResult> {
  if (!prompt.trim()) {
    return {
      success: false,
      error: "Code prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "code",
      coinCost,
      prompt,
      {
        feature: "code",
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
        "Code generation could not be created.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
  };
}
