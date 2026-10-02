import { createGeneration } from "./generation";
import { invokeEdgeFunction } from "./edgeFunctions";

export interface CodeGenerationResult {
  success: boolean;
  generationId?: string;
  code?: string;
  error?: string;
}

export type CodeResponse =
  CodeGenerationResult;

const CODE_SYSTEM_PROMPT =
  "You are CREOVA AI Code. Return only the requested code. Do not add explanations unless explicitly requested. Use correct production-ready syntax.";

export async function generateCode(
  prompt: string,
): Promise<CodeGenerationResult> {
  const cleanPrompt =
    prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error:
        "Code prompt is required.",
    };
  }

  const generation =
    await createGeneration(
      "code",
      undefined,
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

  const {
    data,
    error,
  } =
    await invokeEdgeFunction<{
      success: boolean;
      text?: string;
      message?: string;
      error?: string;
    }>(
      "gemini-chat",
      {
        body: {
          generationId:
            generation.generationId,

          // NOTE: gemini-chat requires generationType (without it,
          // it immediately rejects the request with "Invalid
          // generation type.").
          generationType:
            "code",

          systemPrompt:
            CODE_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content:
                cleanPrompt,
            },
          ],
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
        "Code generation failed.",
    };
  }

  return {
    success: true,
    generationId:
      generation.generationId,
    code:
      data.text ??
      data.message ??
      "",
  };
    }
