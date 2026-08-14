import { supabase } from "./supabase";
import {
  getFeatureCost,
} from "./featureCosts";
import {
  GenerationRequest,
  GenerationResult,
} from "./generationTypes";
import {
  chargeCoins,
} from "./coinOperations";

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

  if (!userData.user) {
    return {
      success: false,
      error: "Authentication required.",
    };
  }

  const cost =
    getFeatureCost(request.type);

  /*
   * The generation record function creates the
   * history record first. The returned generationId
   * becomes the idempotency/reference key for the
   * coin charge.
   */

  const {
    data,
    error,
  } = await supabase.functions.invoke(
    "generation-record",
    {
      body: {
        type: request.type,
        prompt,
        cost,
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

  if (
    !data ||
    data.success !== true ||
    typeof data.generationId !==
      "string"
  ) {
    return {
      success: false,
      error:
        typeof data?.error === "string"
          ? data.error
          : "Unable to create generation.",
    };
  }

  const generationId =
    data.generationId;

  /*
   * Charge coins only after the generation
   * record exists.
   */
  const charge =
    await chargeCoins(
      cost,
      "generation",
      generationId,
      `CREOVA ${request.type} generation`
    );

  if (!charge.success) {
    await updateGenerationRecord(
      generationId,
      {
        status: "failed",
        errorMessage:
          charge.error ??
          "Coin charge failed.",
      }
    );

    return {
      success: false,
      generationId,
      error:
        charge.error ??
        "Insufficient coins.",
    };
  }

  return {
    success: true,
    generationId,
  };
}

export async function updateGenerationRecord(
  generationId: string,
  update: {
    status: "queued" |
      "processing" |
      "completed" |
      "failed" |
      "cancelled";
    resultText?: string;
    resultUrl?: string;
    provider?: string;
    model?: string;
    errorMessage?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
}> {
  const cleanId =
    generationId.trim();

  if (!cleanId) {
    return {
      success: false,
      error:
        "Generation ID is required.",
    };
  }

  try {
    const {
      data,
      error,
    } =
      await supabase.functions.invoke(
        "generation-update",
        {
          body: {
            generationId: cleanId,
            status: update.status,
            resultText:
              update.resultText ??
              null,
            resultUrl:
              update.resultUrl ??
              null,
            provider:
              update.provider ??
              null,
            model:
              update.model ??
              null,
            errorMessage:
              update.errorMessage ??
              null,
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
      success:
        data?.success === true,
      error:
        typeof data?.error === "string"
          ? data.error
          : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Generation update failed.",
    };
  }
      }
