import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

const CREOVA_SYSTEM_PROMPT =
  "You are CREOVA, a helpful AI assistant. Give clear, accurate and useful answers.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Method not allowed.",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }

  try {
    const apiKey =
      Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured."
      );
    }

    const body = await req.json();

    const prompt =
      typeof body?.prompt === "string"
        ? body.prompt.trim()
        : "";

    const requestedModel =
      typeof body?.model === "string"
        ? body.model.trim()
        : "";

    if (!prompt) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Prompt is required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
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
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: CREOVA_SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      }
    );

    const result =
      await response.json();

    if (!response.ok) {
      console.error(
        "OpenAI API error:",
        result
      );

      return new Response(
        JSON.stringify({
          success: false,
          error:
            result?.error?.message ||
            "OpenAI API request failed.",
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    const message =
      result?.choices?.[0]?.message?.content;

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "OpenAI returned an empty response.",
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: message.trim(),
        model,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  } catch (error) {
    console.error(
      "openai-chat error:",
      error
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      }
    );
  }
});
