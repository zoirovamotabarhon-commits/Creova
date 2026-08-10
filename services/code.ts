import { supabase } from "./supabase";

export interface CodeResponse {
  success: boolean;
  code?: string;
  error?: string;
}

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

  const codeSystemPrompt = `
You are CREOVA AI Code.

Generate production-quality code based on the user's request.

Rules:
- Return only the code.
- Do not add explanations before or after the code.
- Use TypeScript/TSX when the request is for React Native or Expo.
- Keep the code complete and runnable.
- Do not use fake API keys or secrets.
- Do not invent unavailable project files.
- If the request depends on an existing service, clearly use the existing service contract.
`.trim();

  try {
    const { data, error } =
      await supabase.functions.invoke(
        "openai-chat",
        {
          body: {
            prompt: cleanPrompt,
            systemPrompt: codeSystemPrompt,
          },
        }
      );

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: false,
        error:
          "AI server returned an empty response.",
      };
    }

    if (data.success !== true) {
      return {
        success: false,
        error:
          typeof data.error === "string"
            ? data.error
            : "Code generation failed.",
      };
    }

    if (
      typeof data.text !== "string" ||
      !data.text.trim()
    ) {
      return {
        success: false,
        error:
          "AI server returned empty code.",
      };
    }

    return {
      success: true,
      code: data.text.trim(),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Code generation failed.",
    };
  }
}
