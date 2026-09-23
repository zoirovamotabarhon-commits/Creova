import { supabase } from "./supabase";
import { invokeEdgeFunction } from "./edgeFunctions";

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
  referenceId: string,
  description = "CREOVA generation"
): Promise<CoinOperationResponse> {
  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      success: false,
      error: "Amount must be a positive integer.",
    };
  }

  const cleanReferenceId = referenceId.trim();

  if (!cleanReferenceId) {
    return {
      success: false,
      error: "Reference ID is required.",
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

    const {
      data,
      error,
    } = await invokeEdgeFunction<Record<string, unknown>>(
      "coin-operation",
      {
        body: {
          operation: "charge",
          amount,
          referenceId: cleanReferenceId,
          description,
        },
      }
    );

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data || typeof data !== "object") {
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
