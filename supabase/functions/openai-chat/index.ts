import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  getGenerationForUser,
  updateGeneration,
} from "../_shared/generation.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY") ?? "";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type": "application/json",
};

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

function getAdminClient() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase server configuration is missing.",
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function requireUser(
  req: Request,
) {
  const authorization =
    req.headers.get(
      "Authorization",
    );

  if (
    !authorization?.startsWith(
      "Bearer ",
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
    getAdminClient();

  const {
    data,
    error,
  } =
    await admin.auth.getUser(
      token,
    );

  if (
    error ||
    !data.user
  ) {
    return null;
  }

  return data.user;
}

function normalizeMessages(
  value: unknown,
): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (message) => {
        if (
          !message ||
          typeof message !==
            "object"
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
            item.role ===
              "user" ||
            item.role ===
              "assistant" ||
            item.role ===
              "system"
          ) &&
          typeof item.content ===
            "string" &&
          item.content.trim()
            .length > 0
        );
      },
    )
    .slice(-MAX_MESSAGES)
    .map(
      (message) => {
        const item =
          message as Record<
            string,
            unknown
          >;

        return {
          role:
            item.role as MessageRole,

          content:
            String(
              item.content,
            )
              .trim()
              .slice(
                0,
                MAX_CONTENT_LENGTH,
              ),
        };
      },
    );
}

function getGenerationType(
  value: unknown,
): "chat" | "code" {
  return value === "code"
    ? "code"
    : "chat";
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
            CORS_HEADERS,
        },
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return json(
        {
          success: false,
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    let generationId = "";
    let userId = "";
    let generationType:
      | "chat"
      | "code" = "chat";

    try {
      if (!OPENAI_API_KEY) {
        return json(
          {
            success: false,
            error:
              "OPENAI_API_KEY is not configured.",
          },
          500,
        );
      }

      const user =
        await requireUser(
          req,
        );

      if (!user) {
        return json(
          {
            success: false,
            error:
              "Authentication required.",
          },
          401,
        );
      }

      userId = user.id;

      let body:
        Record<
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

      generationId =
        typeof body.generationId ===
        "string"
          ? body.generationId.trim()
          : "";

      if (!generationId) {
        return json(
          {
            success: false,
            error:
              "Generation ID is required.",
          },
          400,
        );
      }

      generationType =
        getGenerationType(
          body.generationType,
        );

      /*
       * Verify that the generation:
       *
       * 1. belongs to the authenticated user
       * 2. has the expected type
       * 3. can legally move into processing
       *
       * This prevents another user from using a generation ID
       * and prevents a completed/failed generation from being
       * charged/provider-called again.
       */
      await getGenerationForUser(
        generationId,
        userId,
        generationType,
      );

      const messages =
        normalizeMessages(
          body.messages,
        );

      if (
        messages.length ===
        0
      ) {
        return json(
          {
            success: false,
            error:
              "At least one message is required.",
          },
          400,
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
                MAX_CONTENT_LENGTH,
              )
          : DEFAULT_SYSTEM_PROMPT;

      const requestedModel =
        typeof body.model ===
        "string"
          ? body.model.trim()
          : "";

      const model =
        requestedModel ||
        (
          generationType ===
          "code"
            ? Deno.env.get(
                "OPENAI_CODE_MODEL",
              )
            : Deno.env.get(
                "OPENAI_CHAT_MODEL",
              )
        ) ||
        Deno.env.get(
          "OPENAI_MODEL",
        ) ||
        "gpt-5.5";

      const temperature =
        typeof body.temperature ===
          "number" &&
        Number.isFinite(
          body.temperature,
        )
          ? Math.max(
              0,
              Math.min(
                2,
                body.temperature,
              ),
            )
          : undefined;

      const maxTokens =
        typeof body.max_tokens ===
          "number" &&
        Number.isInteger(
          body.max_tokens,
        )
          ? Math.max(
              1,
              Math.min(
                32000,
                body.max_tokens,
              ),
            )
          : undefined;

      const topP =
        typeof body.top_p ===
          "number" &&
        Number.isFinite(
          body.top_p,
        )
          ? Math.max(
              0,
              Math.min(
                1,
                body.top_p,
              ),
            )
          : undefined;

      /*
       * Atomically claim the generation.
       *
       * If another request already claimed it, updateGeneration()
       * will reject the transition and the provider will NOT be called.
       */
      await updateGeneration({
        generationId,
        userId,
        status:
          "processing",
        expectedType:
          generationType,
      });

      const openAIMessages = [
        {
          role:
            "system" as const,
          content:
            systemPrompt,
        },
        ...messages,
      ];

      const requestBody: Record<
        string,
        unknown
      > = {
        model,
        messages:
          openAIMessages,
      };

      if (
        temperature !==
        undefined
      ) {
        requestBody.temperature =
          temperature;
      }

      if (
        maxTokens !==
        undefined
      ) {
        requestBody.max_tokens =
          maxTokens;
      }

      if (
        topP !==
        undefined
      ) {
        requestBody.top_p =
          topP;
      }

      const response =
        await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${OPENAI_API_KEY}`,
            },

            body:
              JSON.stringify(
                requestBody,
              ),
          },
        );

      const rawText =
        await response.text();

      let result:
        Record<
          string,
          unknown
        > = {};

      try {
        result =
          rawText
            ? (JSON.parse(
                rawText,
              ) as Record<
                string,
                unknown
              >)
            : {};
      } catch {
        result = {
          raw: rawText,
        };
      }

      if (!response.ok) {
        const errorObject =
          result.error;

        const message =
          errorObject &&
          typeof errorObject ===
            "object"
            ? (
                errorObject as {
                  message?: unknown;
                }
              ).message
            : undefined;

        throw new Error(
          typeof message ===
            "string"
            ? message
            : "OpenAI API request failed.",
        );
      }

      const choices =
        Array.isArray(
          result.choices,
        )
          ? result.choices
          : [];

      const firstChoice =
        choices[0];

      const choiceMessage =
        firstChoice &&
        typeof firstChoice ===
          "object"
          ? (
              firstChoice as {
                message?: unknown;
              }
            ).message
          : undefined;

      const text =
        choiceMessage &&
        typeof choiceMessage ===
          "object"
          ? (
              choiceMessage as {
                content?: unknown;
              }
            ).content
          : undefined;

      if (
        typeof text !==
          "string" ||
        !text.trim()
      ) {
        throw new Error(
          "OpenAI returned an empty response.",
        );
      }

      const usage =
        result.usage &&
        typeof result.usage ===
          "object"
          ? result.usage
          : undefined;

      await updateGeneration({
        generationId,
        userId,
        status:
          "completed",
        provider:
          "openai",
        model,
        resultText:
          text.trim(),
        usage,
        expectedType:
          generationType,
      });

      return json({
        success: true,

        generationId,

        text:
          text.trim(),

        model,

        usage,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "OpenAI generation failed.";

      /*
       * Refund is handled by updateGeneration() when a generation
       * transitions from processing to failed.
       */
      if (
        generationId &&
        userId
      ) {
        try {
          await updateGeneration({
            generationId,
            userId,
            status:
              "failed",
            errorMessage,
            expectedType:
              generationType,
          });
        } catch (
          updateError
        ) {
          console.error(
            "Generation failure update failed:",
            updateError,
          );
        }
      }

      console.error(
        "openai-chat error:",
        error,
      );

      return json(
        {
          success: false,

          generationId:
            generationId ||
            undefined,

          error:
            errorMessage,
        },
        500,
      );
    }
  },
);
