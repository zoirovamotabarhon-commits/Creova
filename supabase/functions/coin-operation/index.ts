import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) ??
  Deno.env.get(
    "SUPABASE_SECRET_KEY"
  ) ??
  "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json",
};

function response(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: CORS_HEADERS,
    }
  );
}

async function requireUser(
  req: Request
) {
  const authorization =
    req.headers.get("Authorization");

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "Authentication required."
    );
  }

  const token =
    authorization
      .replace("Bearer ", "")
      .trim();

  if (
    !SUPABASE_URL ||
    !SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const admin = createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const {
    data,
    error,
  } =
    await admin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(
      "Invalid or expired authentication token."
    );
  }

  return {
    user: data.user,
    admin,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== "POST") {
    return response(
      {
        success: false,
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    const {
      user,
      admin,
    } = await requireUser(req);

    const body =
      (await req.json()) as Record<
        string,
        unknown
      >;

    const operation =
      body.operation;

    const amount =
      body.amount;

    const reason =
      typeof body.reason === "string"
        ? body.reason
        : "other";

    const referenceId =
      typeof body.referenceId === "string"
        ? body.referenceId
        : null;

    const description =
      typeof body.description === "string"
        ? body.description
        : null;

    if (
      operation !== "charge" &&
      operation !== "credit"
    ) {
      return response(
        {
          success: false,
          error:
            "Invalid coin operation.",
        },
        400
      );
    }

    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return response(
        {
          success: false,
          error:
            "Amount must be a positive integer.",
        },
        400
      );
    }

    const transactionType =
      operation === "charge"
        ? "debit"
        : "credit";

    const { data, error } =
      await admin.rpc(
        "change_wallet_balance",
        {
          p_user_id: user.id,
          p_amount: amount,
          p_transaction_type:
            transactionType,
          p_reason: reason,
          p_reference_id:
            referenceId,
          p_description:
            description,
          p_metadata: {
            source: "coin-operation",
          },
        }
      );

    if (error) {
      return response(
        {
          success: false,
          error: error.message,
        },
        400
      );
    }

    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    if (!result) {
      return response(
        {
          success: false,
          error:
            "Coin operation returned no result.",
        },
        500
      );
    }

    return response({
      success: true,
      transactionId:
        result.transaction_id,
      walletId:
        result.wallet_id,
      previousBalance:
        Number(result.previous_balance),
      newBalance:
        Number(result.new_balance),
    });
  } catch (error) {
    return response(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Coin operation failed.",
      },
      500
    );
  }
});
