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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function requireUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are not configured."
    );
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization) {
    return null;
  }

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

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
    const user = await requireUser(req);

    if (!user) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized.",
        },
        401
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        {
          success: false,
          error: "OPENAI_API_KEY is not configured.",
        },
        500
      );
    }

    const body = await req.json();

    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";

    const systemPrompt =
      typeof body?.systemPrompt === "string" &&
      body.systemPrompt.trim()
        ? body.systemPrompt.trim()
        : DEFAULT_SYSTEM_PROMPT;

    const requestedModel =
      typeof body?.model === "string"
        ? body.model.trim()
        : "";

    if (!prompt) {
      return jsonResponse(
        {
          success: false,
          error: "Prompt is required.",
        },
        400
      );
    }

    const model =
      requestedModel ||
      Deno.env.get("OPENAI_MODEL") ||
      "gpt-4o-mini";

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", result);

      return jsonResponse(
        {
          success: false,
          error:
            result?.error?.message ||
            "OpenAI API request failed.",
        },
        response.status
      );
    }

    const text =
      result?.choices?.[0]?.message?.content;

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
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
      text: text.trim(),
      model,
      userId: user.id,
    });
  } catch (error) {
    console.error("openai-chat error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500
    );
  }
});
