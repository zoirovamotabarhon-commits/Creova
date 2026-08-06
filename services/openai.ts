import { supabase } from "./supabase";
import { OPENAI_MODEL } from "./config";

export interface GenerateTextResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export const generateText = async (
  prompt: string
): Promise<GenerateTextResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "openai-chat",
      {
        body: {
          model: OPENAI_MODEL,
          prompt,
        },
      }
    );

    if (error) {
      throw error;
    }

    return {
      success: true,
      text: data?.text ?? "",
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    };
  }
};
