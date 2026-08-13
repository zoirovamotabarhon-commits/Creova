import { supabase } from "./supabase";
import {
  GenerationRequest,
  GenerationResult,
} from "./generationTypes";

export async function createGenerationRecord(
  request: GenerationRequest
): Promise<GenerationResult> {
  const prompt =
    request.prompt.trim();

  if (!prompt) {
    return {
      success: false,
      error: "Prompt is required.",
    };
  }

  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser();

  if (userError) {
    return {
      success: false,
      error: userError.message,
    };
  }

  const user = userData.user;

  if (!user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const { data, error } =
    await supabase.functions.invoke(
      "generation-record",
      {
        body: {
          type: request.type,
          prompt,
          metadata:
            request.metadata ?? {},
        },
      }
    );

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: data?.success === true,
    generationId:
      typeof data?.generationId === "string"
        ? data.generationId
        : undefined,
    error:
      typeof data?.error === "string"
        ? data.error
        : undefined,
  };
}
