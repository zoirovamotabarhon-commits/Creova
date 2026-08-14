import {
  createClient,
  SupabaseClient,
} from "npm:@supabase/supabase-js@2.57.0";

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GenerationContext {
  id: string;
  userId: string;
  type: string;
  status: GenerationStatus;
  coinCost: number;
  metadata: Record<string, unknown>;
}

export function getSupabaseAdmin(): SupabaseClient {
  const url =
    Deno.env.get("SUPABASE_URL") ?? "";

  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    "";

  if (!url || !key) {
    throw new Error(
      "Supabase server configuration is missing.",
    );
  }

  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export function getInternalKey(): string {
  const key =
    Deno.env.get(
      "CREOVA_INTERNAL_KEY",
    ) ?? "";

  if (!key) {
    throw new Error(
      "CREOVA_INTERNAL_KEY is not configured.",
    );
  }

  return key;
}

export async function getGeneration(
  admin: SupabaseClient,
  generationId: string,
): Promise<GenerationContext> {
  if (!generationId.trim()) {
    throw new Error(
      "Generation ID is required.",
    );
  }

  const {
    data,
    error,
  } = await admin
    .from("generation_history")
    .select("*")
    .eq("id", generationId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      "Generation not found.",
    );
  }

  const metadata =
    data.metadata &&
    typeof data.metadata === "object" &&
    !Array.isArray(data.metadata)
      ? data.metadata as Record<
          string,
          unknown
        >
      : {};

  const rawCost =
    metadata.coinCost;

  const coinCost =
    typeof rawCost === "number"
      ? rawCost
      : typeof rawCost === "string"
        ? Number(rawCost)
        : NaN;

  if (
    !Number.isInteger(coinCost) ||
    coinCost <= 0
  ) {
    throw new Error(
      "Generation coin cost is invalid.",
    );
  }

  return {
    id: data.id,
    userId: data.user_id,
    type: data.type,
    status: data.status,
    coinCost,
    metadata,
  };
}

export async function updateGeneration(
  admin: SupabaseClient,
  generationId: string,
  status: GenerationStatus,
  payload: {
    resultText?: string;
    resultUrl?: string;
    provider?: string;
    model?: string;
    errorMessage?: string;
  } = {},
) {
  const update: Record<
    string,
    unknown
  > = {
    status,
    updated_at:
      new Date().toISOString(),
  };

  if (status === "processing") {
    update.started_at =
      new Date().toISOString();
  }

  if (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    update.completed_at =
      new Date().toISOString();
  }

  if (
    payload.resultText !== undefined
  ) {
    update.result_text =
      payload.resultText;
  }

  if (
    payload.resultUrl !== undefined
  ) {
    update.result_url =
      payload.resultUrl;
  }

  if (
    payload.provider !== undefined
  ) {
    update.provider =
      payload.provider;
  }

  if (
    payload.model !== undefined
  ) {
    update.model =
      payload.model;
  }

  if (
    payload.errorMessage !== undefined
  ) {
    update.error_message =
      payload.errorMessage;
  }

  const {
    data,
    error,
  } =
    await admin
      .from("generation_history")
      .update(update)
      .eq("id", generationId)
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function refundGeneration(
  admin: SupabaseClient,
  generation: GenerationContext,
  reason: "failed" | "cancelled",
) {
  const {
    data,
    error,
  } =
    await admin.rpc(
      "change_wallet_balance",
      {
        p_user_id:
          generation.userId,
        p_amount:
          generation.coinCost,
        p_transaction_type:
          "credit",
        p_reason:
          "refund",
        p_reference_id:
          generation.id,
        p_description:
          `CREOVA ${reason} generation refund`,
        p_metadata: {
          generationId:
            generation.id,
          generationType:
            generation.type,
          refundReason:
            reason,
          amount:
            generation.coinCost,
        },
      },
    );

  if (error) {
    throw error;
  }

  return data;
    }
