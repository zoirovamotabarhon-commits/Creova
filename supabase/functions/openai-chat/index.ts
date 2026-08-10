import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const DEFAULT_SYSTEM_PROMPT =
  "You are CREOVA, a helpful AI assistant. Give clear, accurate and useful answers.";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    }
  );
}

async function requireUser(
  req: Request
) {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const supabaseAnonKey =
    Deno.env.get(
      "SUPABASE_ANON_KEY"
    );

  if (
    !supabaseUrl ||
    !supabaseAnonKey
  ) {
    throw new Error(
      "Supabase environment variables are not configured."
    );
  }

  const authorization =
    req.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const supabase =
    createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization:
              authorization,
          },
        },
      }
    );

  const {
    data: { user },
    error,
  } =
    await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed.",
      },
      405
    );
  }

  try {
    const user =
      await requireUser(req);

    if (!user) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized.",
        },
        401
      );
    }

    const apiKey =
      Deno.env.get(
        "OPENAI_API_KEY"
      );

    if (!apiKey) {
      return jsonResponse(
        {
          success: false,
          error:
            "OPENAI_API_KEY is not configured.",
        },
        500
      );
    }

    const body =
      await req.json();

    const prompt =
      typeof body?.prompt ===
      "string"
        ? body.prompt.trim()
        : "";

    const systemPrompt =
      typeof body?.systemPrompt ===
        "string" &&
      body.systemPrompt.trim()
        ? body.systemPrompt.trim()
        : DEFAULT_SYSTEM_PROMPT;

    const requestedModel =
      typeof body?.model ===
      "string"
       
