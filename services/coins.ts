import { supabase } from "./supabase";

export type CoinTransactionType =
  | "credit"
  | "debit";

export type CoinTransactionReason =
  | "purchase"
  | "bonus"
  | "refund"
  | "admin_adjustment"
  | "generation"
  | "subscription"
  | "other";

export interface CoinTransaction {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  transaction_type: CoinTransactionType;
  reason: CoinTransactionReason;
  reference_id?: string | null;
  description?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CoinTransactionsResponse {
  success: boolean;
  data?: CoinTransaction[];
  error?: string;
}

const TRANSACTION_TYPES: CoinTransactionType[] = [
  "credit",
  "debit",
];

const TRANSACTION_REASONS: CoinTransactionReason[] = [
  "purchase",
  "bonus",
  "refund",
  "admin_adjustment",
  "generation",
  "subscription",
  "other",
];

const isTransactionType = (
  value: unknown
): value is CoinTransactionType =>
  typeof value === "string" &&
  TRANSACTION_TYPES.includes(
    value as CoinTransactionType
  );

const isTransactionReason = (
  value: unknown
): value is CoinTransactionReason =>
  typeof value === "string" &&
  TRANSACTION_REASONS.includes(
    value as CoinTransactionReason
  );

const normalizeTransaction = (
  value: unknown
): CoinTransaction | null => {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const item =
    value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.user_id !== "string" ||
    typeof item.wallet_id !== "string" ||
    typeof item.amount !== "number" ||
    !isTransactionType(
      item.transaction_type
    ) ||
    !isTransactionReason(item.reason) ||
    typeof item.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: item.id,
    user_id: item.user_id,
    wallet_id: item.wallet_id,
    amount: Math.trunc(item.amount),
    transaction_type:
      item.transaction_type,
    reason: item.reason,
    reference_id:
      typeof item.reference_id === "string"
        ? item.reference_id
        : null,
    description:
      typeof item.description === "string"
        ? item.description
        : null,
    metadata:
      item.metadata &&
      typeof item.metadata === "object" &&
      !Array.isArray(item.metadata)
        ? (item.metadata as Record<
            string,
            unknown
          >)
        : {},
    created_at: item.created_at,
  };
};

export async function getCoinTransactions(
  options?: {
    limit?: number;
    type?: CoinTransactionType;
    reason?: CoinTransactionReason;
  }
): Promise<CoinTransactionsResponse> {
  try {
    const limit = Math.min(
      Math.max(
        options?.limit ?? 50,
        1
      ),
      100
    );

    let query = supabase
      .from("coin_transactions")
      .select(
        [
          "id",
          "user_id",
          "wallet_id",
          "amount",
          "transaction_type",
          "reason",
          "reference_id",
          "description",
          "metadata",
          "created_at",
        ].join(", ")
      )
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (options?.type) {
      query = query.eq(
        "transaction_type",
        options.type
      );
    }

    if (options?.reason) {
      query = query.eq(
        "reason",
        options.reason
      );
    }

    const {
      data,
      error,
    } = await query;

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    const transactions = (data ?? [])
      .map(normalizeTransaction)
      .filter(
        (
          item
        ): item is CoinTransaction =>
          item !== null
      );

    return {
      success: true,
      data: transactions,
    };
  } catch (error) {
    console.error(
      "getCoinTransactions error:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load coin transactions.",
    };
  }
  }
