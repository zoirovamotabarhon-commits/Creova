import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        success: false,
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    const authorization =
      req.headers.get("Authorization");

    if (
      !authorization?.startsWith(
        "Bearer "
      )
    ) {
      return json(
        {
          success: false,
          error: "Authentication required.",
        },
        401
      );
    }

    if (
      !SUPABASE_URL ||
      !SERVICE_ROLE_KEY
    ) {
      return json(
        {
          success: false,
          error:
            "Supabase server configuration is missing.",
        },
        500
      );
    }

    const token =
      authorization
        .slice("Bearer ".length)
        .trim();

    const admin =
      createClient(
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
      data: userData,
      error: userError,
    } =
      await admin.auth.getUser(token);

    if (
      userError ||
      !userData.user
    ) {
      return json(
        {
          success: false,
          error:
            "Invalid or expired authentication token.",
        },
        401
      );
    }

    const body =
      (await req.json()) as Record<
        string,
        unknown
      >;

    if (body.operation !== "charge") {
      return json(
        {
          success: false,
          error:
            "Only generation charges are allowed from the client.",
        },
        403
      );
    }

    const amount = body.amount;

    if (
      typeof amount !== "number" ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      return json(
        {
          success: false,
          error:
            "Amount must be a positive integer.",
        },
        400
      );
    }

    const referenceId =
      typeof body.referenceId === "string"
        ? body.referenceId.trim()
        : "";

    if (!referenceId) {
      return json(
        {
          success: false,
          error: "Reference ID is required.",
        },
        400
      );
    }

    const description =
      typeof body.description === "string"
        ? body.description
        : "CREOVA generation";

    const {
      data,
      error,
    } =
      await admin.rpc(
        "change_wallet_balance",
        {
          p_user_id: userData.user.id,
          p_amount: amount,
          p_transaction_type: "debit",
          p_reason: "generation",
          p_reference_id: referenceId,
          p_description: description,
          p_metadata: {
            source: "creova-generation",
          },
        }
      );

    if (error) {
      return json(
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
      return json(
        {
          success: false,
          error:
            "Coin operation returned no result.",
        },
        500
      );
    }

    return json({
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
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Coin charge failed.",
      },
      500
    );
  }
});
