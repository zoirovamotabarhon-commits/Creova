import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import OpenAI from "npm:openai@6.49.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SECRET_KEYS = Deno.env.get("SUPABASE_SECRET_KEYS");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function getSecretKey(): string {
  if (!SUPABASE_SECRET_KEYS) {
    throw new Error(
      "SUPABASE_SECRET_KEYS is not configured."
    );
  }

  try {
    const keys = JSON.parse(
      SUPABASE_SECRET_KEYS
    ) as Record<string, unknown>;

    const key = keys.default;

    if (
      typeof key !== "string" ||
      !key.trim()
    ) {
      throw new Error(
        "Default Supabase secret key is missing."
      );
    }

    return key;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Invalid SUPABASE_SECRET_KEYS."
    );
  }
}

async function requireUser(req: Request) {
  const authorization = req.headers.get("Authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    throw new Error("Authentication required.");
  }

  const token = authorization
    .replace("Bearer ", "")
    .trim();

  if (!token) {
    throw new Error("Authentication token is missing.");
  }

  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  const supabase = createClient(
    SUPABASE_URL,
    getSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(
      "Invalid or expired authentication token."
    );
  }

  return data.user;
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: CORS_HEADERS,
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
    if (!OPENAI_API_KEY) {
      return jsonResponse(
        {
          success: false,
          error: "OPENAI_API_KEY is not configured.",
        },
        500
      );
    }

    await requireUser(req);

    let body: Record<string, unknown>;

    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        400
      );
    }

    const prompt = body.prompt;
    const systemPrompt =
      typeof body.systemPrompt === "string"
        ? body.systemPrompt.trim()
        : "";

    if (
      typeof prompt !== "string" ||
      !prompt.trim()
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Prompt is required.",
        },
        400
      );
    }

    const requestedModel = body.model;
    const model =
      typeof requestedModel === "string" &&
      requestedModel.trim()
        ? requestedModel.trim()
        : "gpt-5.5";

    const userPrompt = prompt.trim();
    const combinedPrompt = systemPrompt
      ? `${systemPrompt}\n\nUser request:\n${userPrompt}`
      : userPrompt;

    const response = await openai.responses.create({
      model,
      input: combinedPrompt,
    });

    const text = response.output_text ?? "";

    if (!text.trim()) {
      return jsonResponse(
        {
          success: false,
          error: "OpenAI returned an empty response.",
        },
        502
      );
    }

    return jsonResponse({
      success: true,
      text,
    });
  } catch (error) {
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
});
