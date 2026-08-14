import { supabase } from "./supabase";

export interface CoinOperationResponse {
  success: boolean;
  transactionId?: string;
  walletId?: string;
  previousBalance?: number;
  newBalance?: number;
  error?: string;
}

export async function chargeCoins(
  amount: number,
  reason = "generation",
  referenceId?: string,
  description?: string
): Promise<CoinOperationResponse> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      success: false,
      error: "Amount must be a positive integer.",
    };
  }

  try {
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      return {
        success: false,
        error: sessionError.message,
      };
    }

    if (!sessionData.session) {
      return {
        success: false,
        error: "Authentication required.",
      };
    }

    const { data, error } =
      await supabase.functions.invoke(
        "coin-operation",
        {
          body: {
            operation: "charge",
            amount,
            reason,
            referenceId:
              referenceId ?? null,
            description:
              description ?? null,
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
      typeof data !== "object"
    ) {
      return {
        success: false,
        error: "Invalid coin operation response.",
      };
    }

    return {
      success: data.success === true,
      transactionId:
        typeof data.transactionId === "string"
          ? data.transactionId
          : undefined,
      walletId:
        typeof data.walletId === "string"
          ? data.walletId
          : undefined,
      previousBalance:
        typeof data.previousBalance === "number"
          ? data.previousBalance
          : undefined,
      newBalance:
        typeof data.newBalance === "number"
          ? data.newBalance
          : undefined,
      error:
        typeof data.error === "string"
          ? data.error
          : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Coin charge failed.",
    };
  }
}
