import { supabase } from "./supabase";

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletResponse {
  success: boolean;
  data?: Wallet;
  error?: string;
}

const normalizeWallet = (
  value: unknown
): Wallet | null => {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const wallet =
    value as Record<string, unknown>;

  if (
    typeof wallet.id !== "string" ||
    typeof wallet.user_id !== "string" ||
    typeof wallet.balance !== "number" ||
    typeof wallet.created_at !== "string" ||
    typeof wallet.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: wallet.id,
    user_id: wallet.user_id,
    balance: Math.max(
      0,
      Math.floor(wallet.balance)
    ),
    created_at: wallet.created_at,
    updated_at: wallet.updated_at,
  };
};

export async function getWallet(): Promise<WalletResponse> {
  try {
    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

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

    const {
      data,
      error,
    } = await supabase
      .from("wallets")
      .select(
        "id, user_id, balance, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Wallet not found.",
      };
    }

    const wallet = normalizeWallet(data);

    if (!wallet) {
      return {
        success: false,
        error: "Wallet data is invalid.",
      };
    }

    return {
      success: true,
      data: wallet,
    };
  } catch (error) {
    console.error(
      "getWallet error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load wallet.",
    };
  }
}

export async function getCoinBalance(): Promise<{
  success: boolean;
  balance?: number;
  error?: string;
}> {
  const result = await getWallet();

  if (!result.success || !result.data) {
    return {
      success: false,
      error:
        result.error ??
        "Unable to load coin balance.",
    };
  }

  return {
    success: true,
    balance: result.data.balance,
  };
    }
