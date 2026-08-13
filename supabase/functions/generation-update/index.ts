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
      data: userData,
      error: userError,
    } =
      await admin.auth.getUser(token);

    if (
      userError ||
      !userData.user
    ) {
      throw new Error(
        "Invalid or expired authentication token."
      );
    }

    const body =
      (await req.json()) as Record<
        string,
        unknown
      >;

    const generationId =
      body.generationId;

    const status =
      body.status;

    const allowedStatuses = [
      "queued",
      "processing",
      "completed",
      "failed",
      "cancelled",
    ];

    if (
      typeof generationId !==
        "string" ||
      !generationId.trim()
    ) {
      return json(
        {
          success: false,
          error:
            "Generation ID is required.",
        },
        400
      );
    }

    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status)
    ) {
      return json(
        {
          success: false,
          error:
            "Invalid generation status.",
        },
        400
      );
    }

    const update: Record<
      string,
      unknown
    > = {
      status,
    };

    if (
      status === "processing"
    ) {
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
      typeof body.resultText ===
      "string"
    ) {
      update.result_text =
        body.resultText;
    }

    if (
      typeof body.resultUrl ===
      "string"
    ) {
      update.result_url =
        body.resultUrl;
    }

    if (
      typeof body.errorMessage ===
      "string"
    ) {
      update.error_message =
        body.errorMessage;
    }

    if (
      typeof body.provider ===
      "string"
    ) {
      update.provider =
        body.provider;
    }

    if (
      typeof body.model ===
      "string"
    ) {
      update.model =
        body.model;
    }

    const { error } =
      await admin
        .from("generation_history")
        .update(update)
        .eq(
          "id",
          generationId.trim()
        )
        .eq(
          "user_id",
          userData.user.id
        );

    if (error) {
      throw error;
    }

    return json({
      success: true,
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
