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

const INTERNAL_KEY =
  Deno.env.get("CREOVA_INTERNAL_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-creova-internal-key",
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

function validStatus(
  value: unknown
): value is GenerationStatus {
  return (
    typeof value === "string" &&
    STATUSES.includes(
      value as GenerationStatus
    )
  );
}

function validTransition(
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

function isInternalRequest(
  req: Request
): boolean {
  if (!INTERNAL_KEY) {
    return false;
  }

  return (
    req.headers.get(
      "x-creova-internal-key"
    ) === INTERNAL_KEY
  );
}

async function getAuthenticatedUser(
  req: Request
) {
  const authorization =
    req.headers.get("Authorization");

  if (
    !authorization?.startsWith(
      "Bearer "
    )
  ) {
    return null;
  }

  const token =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!token) {
    return null;
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
    data,
    error,
  } =
    await admin.auth.getUser(token);

  if (
    error ||
    !data.user
  ) {
    return null;
  }

  return data.user;
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

  try {
    const internal =
      isInternalRequest(req);

    const user =
      internal
        ? null
        : await getAuthenticatedUser(
            req
          );

    if (!internal && !user) {
      return json(
        {
          success: false,
          error: "Unauthorized.",
        },
        401
      );
    }

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

    if (!validStatus(status)) {
      return json(
        {
          success: false,
          error:
            "Invalid generation status.",
        },
        400
      );
    }

    /*
     * Terminal states may ONLY be written by
     * trusted server-side AI functions.
     */
    if (
      TERMINAL_STATUSES.includes(status) &&
      !internal
    ) {
      return json(
        {
          success: false,
          error:
            "Terminal generation updates are server-only.",
        },
        403
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

    let query =
      admin
        .from("generation_history")
        .select("*")
        .eq("id", generationId);

    if (!internal && user) {
      query = query.eq(
        "user_id",
        user.id
      );
    }

    const {
      data: existing,
      error: readError,
    } = await query.maybeSingle();

    if (readError) {
      throw readError;
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

    const current =
      existing.status as GenerationStatus;

    if (!validStatus(current)) {
      return json(
        {
          success: false,
          error:
            "Existing generation status is invalid.",
        },
        500
      );
    }

    if (
      !validTransition(
        current,
        status
      )
    ) {
      return json(
        {
          success: false,
          error:
            `Invalid status transition: ${current} -> ${status}.`,
        },
        409
      );
    }

    const update: Record<
      string,
      unknown
    > = {
      status,
      updated_at:
        new Date().toISOString(),
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

    if (
      status === "completed" &&
      typeof body.resultText === "string"
    ) {
      update.result_text =
        body.resultText.trim();
    }

    if (
      status === "completed" &&
      typeof body.resultUrl === "string"
    ) {
      update.result_url =
        body.resultUrl.trim();
    }

    if (
      typeof body.provider === "string"
    ) {
      update.provider =
        body.provider.trim();
    }

    if (
      typeof body.model === "string"
    ) {
      update.model =
        body.model.trim();
    }

    if (
      (
        status === "failed" ||
        status === "cancelled"
      ) &&
      typeof body.errorMessage === "string"
    ) {
      update.error_message =
        body.errorMessage.trim();
    }

    const {
      error: updateError,
    } =
      await admin
        .from("generation_history")
        .update(update)
        .eq("id", generationId);

    if (updateError) {
      throw updateError;
    }

    /*
     * Refund is performed ONLY by this trusted server path.
     */
    let refund = null;

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
              "Generation cost is invalid; refund was not performed.",
            generationId,
          },
          500
        );
      }

      const {
        data,
        error,
      } =
        await admin.rpc(
          "change_wallet_balance",
          {
            p_user_id:
              existing.user_id,
            p_amount:
              coinCost,
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
              amount:
                coinCost,
            },
          }
        );

      if (error) {
        throw new Error(
          `Refund failed: ${error.message}`
        );
      }

      refund =
        Array.isArray(data)
          ? data[0] ?? null
          : data;
    }

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
    console.error(
      "generation-update error:",
      error
    );

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
