import { generateText } from "./openai";

export interface CodeResponse {
  success: boolean;
  code?: string;
  error?: string;
}

const CODE_SYSTEM_PROMPT = `
You are CREOVA AI Code.

Generate production-quality code based on the user's request.

Rules:
- Return only the code.
- Do not add explanations before or after the code.
- Use TypeScript/TSX for React Native or Expo requests.
- Keep the code complete and runnable.
- Do not use fake API keys or secrets.
- Never expose private credentials.
- Do not invent unavailable project files.
- Respect existing project service contracts.
- Preserve existing imports and project architecture when possible.
- If the user asks to replace a file, return the complete file.
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

  try {
    const result =
      await generateText(
        [
          {
            role: "user",
            content: cleanPrompt,
          },
        ],
        {
          systemPrompt:
            CODE_SYSTEM_PROMPT,
        }
      );

    if (!result.success) {
      return {
        success: false,
        error:
          result.error ||
          "Code generation failed.",
      };
    }

    const code =
      result.text?.trim() || "";

    if (!code) {
      return {
        success: false,
        error:
          "AI server returned empty code.",
      };
    }

    return {
      success: true,
      code,
    };
  } catch (error) {
    console.error(
      "generateCode error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Code generation failed.",
    };
  }
}
