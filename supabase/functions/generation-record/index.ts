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

type GenerationType = keyof typeof COSTS;

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: CORS_HEADERS,
    },
  );
}

function isValidUuid(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isGenerationType(
  value: unknown,
): value is GenerationType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      COSTS,
      value,
    )
  );
}

function normalizeMetadata(
  value: unknown,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
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
      405,
    );
  }

  try {
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
        500,
      );
    }

    const authorization =
      req.headers.get(
        "Authorization",
      );

    if (
      !authorization?.startsWith(
        "Bearer ",
      )
    ) {
      return json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        401,
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
          error:
            "Authentication token is missing.",
        },
        401,
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
        },
      );

    const {
      data: userData,
      error: userError,
    } =
      await admin.auth.getUser(
        token,
      );

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
        401,
      );
    }

    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        (await req.json()) as Record<
          string,
          unknown
        >;
    } catch {
      return json(
        {
          success: false,
          error:
            "Invalid JSON request body.",
        },
        400,
      );
    }

    const generationId =
      typeof body.generationId ===
      "string"
        ? body.generationId.trim()
        : "";

    if (
      !isValidUuid(
        generationId,
      )
    ) {
      return json(
        {
          success: false,
          error:
            "Valid generation ID is required.",
        },
        400,
      );
    }

    const type =
      body.type;

    if (
      !isGenerationType(type)
    ) {
      return json(
        {
          success: false,
          error:
            "Invalid generation type.",
        },
        400,
      );
    }

    const prompt =
      typeof body.prompt ===
      "string"
        ? body.prompt.trim()
        : "";

    if (!prompt) {
      return json(
        {
          success: false,
          error:
            "Prompt is required.",
        },
        400,
      );
    }

    if (
      prompt.length > 12000
    ) {
      return json(
        {
          success: false,
          error:
            "Prompt is too long.",
        },
        400,
      );
    }

    const userId =
      userData.user.id;

    const cost =
      COSTS[type];

    const metadata =
      normalizeMetadata(
        body.metadata,
      );

    /*
     * Idempotency:
     *
     * The client generates generationId before calling
     * this function. If the same request is retried,
     * we must never charge the user twice.
    
