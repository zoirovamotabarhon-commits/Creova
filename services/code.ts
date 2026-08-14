import { generateText } from "./openai";
import {
  createGenerationRecord,
  updateGenerationRecord,
} from "./generation";

export interface CodeResponse {
  success: boolean;
  code?: string;
  generationId?: string;
  error?: string;
}

const CODE_SYSTEM_PROMPT = `
You are CREOVA AI Code.

Generate production-quality code based on the user's request.

Rules:
- Return only the code.
- Do not add explanations.
- Use TypeScript/TSX for Expo and React Native.
- Keep the code complete and runnable.
- Never expose credentials or secrets.
- Respect the existing project architecture.
- Preserve existing service contracts when possible.
`.trim();

export async function generateCode(
  prompt: string
): Promise<CodeResponse> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    return {
      success: false,
      error: "Prompt is required.",
    };
  }

  let generationId: string | undefined;

  try {
    const record = await createGenerationRecord({
      type: "code",
      prompt: cleanPrompt,
    });

    if (!record.success || !record.generationId) {
      return {
        success: false,
        error:
          record.error ??
          "Unable to start code generation.",
      };
    }

    generationId = record.generationId;

    await updateGenerationRecord(generationId, {
      status: "processing",
    });

    const result = await generateText(
      [
        {
          role: "user",
          content: cleanPrompt,
        },
      ],
      {
        systemPrompt: CODE_SYSTEM_PROMPT,
      }
    );

    if (!result.success) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage:
          result.error ?? "Code generation failed.",
      });

      return {
        success: false,
        generationId,
        error:
          result.error ?? "Code generation failed.",
      };
    }

    const code = result.text?.trim() ?? "";

    if (!code) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage: "AI returned empty code.",
      });

      return {
        success: false,
        generationId,
        error: "AI server returned empty code.",
      };
    }

    await updateGenerationRecord(generationId, {
      status: "completed",
      resultText: code,
      provider: "openai",
    });

    return {
      success: true,
      code,
      generationId,
    };
  } catch (error) {
    if (generationId) {
      await updateGenerationRecord(generationId, {
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Code generation failed.",
      });
    }

    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Code generation failed.",
    };
  }
}
