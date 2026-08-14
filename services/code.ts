import {
  createGeneration,
} from "./generation";

export interface CodeGenerationResult {
  success: boolean;
  generationId?: string;
  error?: string;
}

export type CodeResponse =
  CodeGenerationResult;

export async function generateCode(
  prompt: string,
  coinCost?: number,
): Promise<CodeGenerationResult> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Code prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "code",
      coinCost,
      cleanPrompt,
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
