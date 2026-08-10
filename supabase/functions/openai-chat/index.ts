import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import OpenAI from "npm:openai@6.49.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY");

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SECRET_KEYS =
  Deno.env.get("SUPABASE_SECRET_KEYS");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json",
};

const CREOVA_SYSTEM_PROMPT = `
You are CREOVA AI, the official AI assistant of the CREOVA platform.

Core rules:
- Give accurate, useful, and direct answers.
- Respond in the user's requested language.
- Do not invent facts, files, APIs, credentials, or completed actions.
- Never reveal API keys, service-role keys, tokens, passwords, or other secrets.
- Never expose internal server configuration.
- When working with CREOVA code, preserve the existing project architecture.
- Do not invent project files that have not been provided.
- When the user asks for code, provide complete runnable code when enough information is available.
- Do not claim that code was tested or deployed unless it actually was.
`.trim();

type JsonObject = Record<string, unknown>;

function jsonResponse(
  body: JsonObject,
  status = 200
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: CORS_HEADERS,
    }
  );
}

function getSupabaseSecretKey(): string {
  if (!SUPABASE_SECRET_KEYS) {
    throw new Error(
      "SUPABASE_SECRET_KEYS is not configured."
    );
  }

  try {
    const parsed =
      JSON.parse(
        SUPABASE_SECRET_KEYS
      ) as Record<string, unknown>;

    const key = parsed.default;

    if (
      typeof key !== "string" ||
      !key.trim()
    ) {
      throw new Error(
        "Default Supabase secret key is missing."
      );
    }

    return key.trim();
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Invalid SUPABASE_SECRET_KEYS."
    );
  }
}

function getSupabaseAdminClient() {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }

  return createClient(
    SUPABASE_URL,
    getSupabaseSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function requireUser(
  req: Request
) {
  const authorization =
    req.headers.get("Authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    throw new Error(
      "Authentication required."
    );
  }

  const token =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!token) {
    throw new Error(
      "Authentication token is missing."
    );
  }

  const supabase =
    getSupabaseAdminClient();

  const {
    data,
    error,
  } =
    await supabase.auth.getUser(
      token
    );

  if (
    error ||
    !data.user
  ) {
    throw new Error(
      "Invalid or expired authentication token."
    );
  }

  return data.user;
}

const openai =
  new OpenAI({
    apiKey:
      OPENAI_API_KEY,
  });

Deno.serve(
  async (req) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          status: 200,
          headers:
            CORS_HEADERS,
        }
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Method not allowed.",
        },
        405
      );
    }

    try {
      if (!OPENAI_API_KEY) {
        return jsonResponse(
          {
            success: false,
            error:
              "OPENAI_API_KEY is not configured.",
          },
          500
        );
      }

      await requireUser(
        req
      );

      let body: JsonObject;

      try {
        body =
          (await req.json()) as JsonObject;
      } catch {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON request body.",
          },
          400
        );
      }

      const prompt =
        body.prompt;

      if (
        typeof prompt !==
          "string" ||
        !prompt.trim()
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Prompt is required.",
          },
          400
        );
      }

      const requestedModel =
        body.model;

      const model =
        typeof requestedModel ===
          "string" &&
        requestedModel.trim()
          ? requestedModel.trim()
          : "gpt-5.5";

      const userPrompt =
        prompt.trim();

      const response =
        await openai.responses.create(
          {
            model,
            instructions:
              CREOVA_SYSTEM_PROMPT,
            input:
              userPrompt,
          }
        );

      const text =
        response.output_text?.trim() ??
        "";

      if (!text) {
        return jsonResponse(
          {
            success: false,
            error:
              "OpenAI returned an empty response.",
          },
          502
        );
      }

      return jsonResponse({
        success: true,
        text,
      });
    } catch (error) {
      console.error(
        "openai-chat error:",
        error
      );

      return jsonResponse(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "AI request failed.",
        },
        500
      );
    }
  }
);
