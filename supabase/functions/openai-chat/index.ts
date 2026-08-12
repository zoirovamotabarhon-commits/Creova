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
  "You are CREOVA AI Assistant. Give clear, useful and accurate answers.";

const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 12000;

type MessageRole =
  | "user"
  | "assistant"
  | "system";

interface ChatMessage {
  role: MessageRole;
  content: string;
}

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
    req.headers.get(
      "Authorization"
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer "
    )
  ) {
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

  if (
    error ||
    !user
  ) {
    return null;
  }

  return user;
}

function normalizeMessages(
  value: unknown
): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((message) => {
      if (
        !message ||
        typeof message !== "object"
      ) {
        return false;
      }

      const item =
        message as Record<
          string,
          unknown
        >;

      return (
        (
          item.role === "user" ||
          item.role ===
            "assistant" ||
          item.role === "system"
        ) &&
        typeof item.content ===
          "string" &&
        item.content.trim()
          .length > 0
      );
    })
    .slice(-MAX_MESSAGES)
    .map((message) => {
      const item =
        message as Record<
          string,
          unknown
        >;

      return {
        role:
          item.role as MessageRole,
        content:
          String(item.content)
            .trim()
            .slice(
              0,
              MAX_CONTENT_LENGTH
            ),
      };
    });
}

Deno.serve(
  async (req) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
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
      const user =
        await requireUser(req);

      if (!user) {
        return jsonResponse(
          {
            success: false,
            error:
              "Unauthorized.",
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
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON request body.",
          },
          400
        );
      }

      const messages =
        normalizeMessages(
          body.messages
        );

      if (
        messages.length === 0
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "At least one message is required.",
          },
          400
        );
      }

      const systemPrompt =
        typeof body.systemPrompt ===
          "string" &&
        body.systemPrompt.trim()
          ? body.systemPrompt
              .trim()
              .slice(
                0,
                MAX_CONTENT_LENGTH
              )
          : DEFAULT_SYSTEM_PROMPT;

      const requestedModel =
        typeof body.model ===
          "string"
          ? body.model.trim()
          : "";

      const model =
        requestedModel ||
        Deno.env.get(
          "OPENAI_MODEL"
        ) ||
        "gpt-5.5";

      const openAIMessages = [
        {
          role: "system",
          content: systemPrompt,
        },
        ...messages,
      ];

      const response =
        await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages:
                openAIMessages,
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
        result?.choices?.[0]
          ?.message?.content;

      if (
        typeof text !==
          "string" ||
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
              : "Unexpected server error.",
        },
        500
      );
    }
  }
);
