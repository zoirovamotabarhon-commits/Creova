import { supabase } from "./supabase";

export interface VoiceResponse {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

export const generateVoice = async (
  text: string
): Promise<VoiceResponse> => {
  try {
    const { data, error } = await supabase.functions.invoke(
      "voice-generate",
      {
        body: {
          text,
        },
      }
    );

    if (error) {
      throw error;
    }

    return {
      success: true,
      audioUrl: data?.audioUrl ?? "",
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
