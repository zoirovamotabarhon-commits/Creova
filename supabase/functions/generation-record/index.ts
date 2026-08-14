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

const COSTS = {
  chat: 1,
  code: 2,
  image: 5,
  video: 15,
  music: 10,
  voice: 5,
} as const;

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

    const type = body.type;

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (
      typeof type !== "string" ||
      !Object.prototype.hasOwnProperty.call(
        COSTS,
        type
      )
    ) {
      return json(
        {
          success: false,
          error:
            "Invalid generation type.",
        },
        400
      );
    }

    if (!prompt) {
      return json(
        {
          success: false,
          error: "Prompt is required.",
        },
        400
      );
    }

    if (prompt.length > 12000) {
      return json(
        {
          success: false,
          error: "Prompt is too long.",
        },
        400
      );
    }

    const cost =
      COSTS[
        type as keyof typeof COSTS
      ];

    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    const {
      data,
      error,
    } =
      await admin
        .from("generation_history")
        .insert({
          user_id:
            userData.user.id,
          type,
          prompt,
          status: "queued",
          metadata: {
            ...metadata,
            coinCost: cost,
          },
        })
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    const {
      data: chargeData,
      error: chargeError,
    } =
      await admin.rpc(
        "change_wallet_balance",
        {
          p_user_id:
            userData.user.id,
          p_amount: cost,
          p_transaction_type:
            "debit",
          p_reason: "generation",
          p_reference_id: data.id,
          p_description:
            `CREOVA ${type} generation`,
          p_metadata: {
            generationId: data.id,
            generationType: type,
            cost,
          },
        }
      );

    if (chargeError) {
      await admin
        .from("generation_history")
        .delete()
        .eq("id", data.id)
        .eq(
          "user_id",
          userData.user.id
        );

      return json(
        {
          success: false,
          error: chargeError.message,
        },
        400
      );
    }

    const charge =
      Array.isArray(chargeData)
        ? chargeData[0]
        : chargeData;

    if (!charge) {
      await admin
        .from("generation_history")
        .delete()
        .eq("id", data.id)
        .eq(
          "user_id",
          userData.user.id
        );

      return json(
        {
          success: false,
          error:
            "Coin charge returned no result.",
        },
        500
      );
    }

    return json({
      success: true,
      generationId: data.id,
      cost,
      newBalance: Number(
        charge.new_balance
      ),
    });
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Generation creation failed.",
      },
      500
    );
  }
});
