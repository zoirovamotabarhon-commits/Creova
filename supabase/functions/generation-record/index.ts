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

    if (
      !SUPABASE_URL ||
      !SERVICE_ROLE_KEY
    ) {
      throw new Error(
        "Supabase server configuration is missing."
      );
    }

    const token =
      authorization
        .replace("Bearer ", "")
        .trim();

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

    const type = body.type;
    const prompt = body.prompt;
    const metadata =
      body.metadata &&
      typeof body.metadata ===
        "object"
        ? body.metadata
        : {};

    const allowedTypes = [
      "chat",
      "code",
      "image",
      "video",
      "music",
      "voice",
    ];

    if (
      typeof type !== "string" ||
      !allowedTypes.includes(type)
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

    if (
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      return json(
        {
          success: false,
          error: "Prompt is required.",
        },
        400
      );
    }

    const { data, error } =
      await admin
        .from("generation_history")
        .insert({
          user_id:
            userData.user.id,
          type,
          prompt:
            prompt.trim(),
          status: "queued",
          metadata,
        })
        .select("id")
        .single();

    if (error) {
      throw error;
    }

    return json({
      success: true,
      generationId: data.id,
    });
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Generation record failed.",
      },
      500
    );
  }
});
