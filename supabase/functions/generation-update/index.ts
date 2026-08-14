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

const STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

type GenerationStatus =
  (typeof STATUSES)[number];

const TERMINAL_STATUSES: GenerationStatus[] = [
  "completed",
  "failed",
  "cancelled",
];

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

function isValidStatus(
  value: unknown
): value is GenerationStatus {
  return (
    typeof value === "string" &&
    STATUSES.includes(
      value as GenerationStatus
    )
  );
}

function canTransition(
  current: GenerationStatus,
  next: GenerationStatus
): boolean {
  if (current === next) {
    return true;
  }

  if (
    TERMINAL_STATUSES.includes(current)
  ) {
    return false;
  }

  if (current === "queued") {
    return [
      "processing",
      "completed",
      "failed",
      "cancelled",
    ].includes(next);
  }

  if (current === "processing") {
    return [
      "completed",
      "failed",
      "cancelled",
    ].includes(next);
  }

  return false;
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
    // ========================================================
    // AUTHENTICATION
    // ========================================================

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

    if (!token) {
      return json(
        {
          success: false,
          error: "Authentication token is missing.",
        },
        401
      );
    }

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

    const userId =
      userData.user.id;

    // ========================================================
    // REQUEST
    // ========================================================

    const body =
      (await req.json()) as Record<
        string,
        unknown
      >;

    const generationId =
      typeof body.generationId === "string"
        ? body.generationId.trim()
        : "";

    const status =
      body.status;

    if (!generationId) {
      return json(
        {
          success: false,
          error:
            "Generation ID is required.",
        },
        400
      );
    }

    if (!isValidStatus(status)) {
      return json(
        {
          success: false,
          error:
            "Invalid generation status.",
        },
        400
      );
    }

    // ========================================================
    // LOAD GENERATION
    // ========================================================

    const {
      data: existing,
      error: existingError,
    } =
      await admin
        .from("generation_history")
        .select(
          [
            "id",
            "user_id",
            "type",
            "status",
            "metadata",
            "started_at",
            "completed_at",
            "result_text",
            "result_url",
            "provider",
            "model",
            "error_message",
          ].join(",")
        )
        .eq("id", generationId)
        .eq("user_id", userId)
        .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (!existing) {
      return json(
        {
          success: false,
          error:
            "Generation record not found.",
        },
        404
      );
    }

    const currentStatus =
      existing.status as GenerationStatus;

    if (!isValidStatus(currentStatus)) {
      return json(
        {
          success: false,
          error:
            "Existing generation has an invalid status.",
        },
        500
      );
    }

    // ========================================================
    // STATUS TRANSITION PROTECTION
    // ========================================================

    if (
      !canTransition(
        currentStatus,
        status
      )
    ) {
      return json(
        {
          success: false,
          error:
            `Invalid status transition: ${currentStatus} -> ${status}.`,
        },
        409
      );
    }

    // ========================================================
    // BUILD UPDATE
    // ========================================================

    const update: Record<
      string,
      unknown
    > = {
      status,
    };

    if (
      status === "processing" &&
      !existing.started_at
    ) {
      update.started_at =
        new Date().toISOString();
    }

    if (
      TERMINAL_STATUSES.includes(status) &&
      !existing.completed_at
    ) {
      update.completed_at =
        new Date().toISOString();
    }

    // --------------------------------------------------------
    // RESULT DATA
    // --------------------------------------------------------

    if (
      status === "completed" &&
      typeof body.resultText === "string"
    ) {
      update.result_text =
        body.resultText;
    }

    if (
      status === "completed" &&
      typeof body.resultUrl === "string"
    ) {
      update.result_url =
        body.resultUrl;
    }

    if (
      typeof body.provider === "string"
    ) {
      update.provider =
        body.provider;
    }

    if (
      typeof body.model === "string"
    ) {
      update.model =
        body.model;
    }

    // --------------------------------------------------------
    // ERROR DATA
    // --------------------------------------------------------

    if (
      (
        status === "failed" ||
        status === "cancelled"
      ) &&
      typeof body.errorMessage === "string"
    ) {
      update.error_message =
        body.errorMessage;
    }

    // ========================================================
    // UPDATE GENERATION
    // ========================================================

    const {
      error: updateError,
    } =
      await admin
        .from("generation_history")
        .update(update)
        .eq("id", generationId)
        .eq("user_id", userId);

    if (updateError) {
      throw updateError;
    }

    // ========================================================
    // AUTOMATIC REFUND
    //
    // failed/cancelled generations return the exact amount
    // originally charged for this generation.
    //
    // change_wallet_balance() validates:
    //   - original generation debit exists
    //   - same user
    //   - same wallet
    //   - exact refund amount
    //   - refund is idempotent
    // ========================================================

    let refund:
      | Record<string, unknown>
      | null = null;

    if (
      status === "failed" ||
      status === "cancelled"
    ) {
      const metadata =
        existing.metadata &&
        typeof existing.metadata === "object" &&
        !Array.isArray(existing.metadata)
          ? (
              existing.metadata as Record<
                string,
                unknown
              >
            )
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
        return json(
          {
            success: false,
            error:
              "Generation failed, but its coin cost could not be determined. Refund was not attempted.",
            generationId,
          },
          500
        );
      }

      const {
        data: refundData,
        error: refundError,
      } =
        await admin.rpc(
          "change_wallet_balance",
          {
            p_user_id: userId,
            p_amount: coinCost,
            p_transaction_type:
              "credit",
            p_reason:
              "refund",
            p_reference_id:
              generationId,
            p_description:
              `CREOVA ${status} generation refund`,
            p_metadata: {
              generationId,
              generationType:
                existing.type,
              refundReason:
                status,
              amount: coinCost,
            },
          }
        );

      if (refundError) {
        return json(
          {
            success: false,
            error:
              "Generation status was updated, but coin refund failed.",
            generationId,
            refundError:
              refundError.message,
          },
          500
        );
      }

      refund =
        Array.isArray(refundData)
          ? refundData[0] ?? null
          : refundData;
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return json({
      success: true,
      generationId,
      status,
      refunded:
        status === "failed" ||
        status === "cancelled",
      refund,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Generation update failed.",
      },
      500
    );
  }
});
