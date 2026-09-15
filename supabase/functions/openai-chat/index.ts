import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  getGenerationForUser,
  updateGeneration,
} from "../_shared/generation.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL",
  ) ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  ) ??
  Deno.env.get(
    "SUPABASE_SECRET_KEY",
  ) ??
  "";

const OPENAI_API_KEY =
  Deno.env.get(
    "OPENAI_API_KEY",
  ) ?? "";

const DEFAULT_SYSTEM_PROMPT =
  "You are CREOVA AI Assistant. Give clear, useful and accurate answers.";

const MAX_MESSAGES = 40;

const MAX_CONTENT_LENGTH =
  12000;

const MAX_IMAGE_URL_LENGTH =
  12_000_000;

type MessageRole =
  | "user"
  | "assistant"
  | "system";

type GenerationType =
  | "chat"
  | "code"
  | "vision";

type TextMessage = {
  role: MessageRole;

  content: string;
};

type ImageContentPart = {
  type: "image_url";

  image_url: {
    url: string;

    detail:
      | "auto"
      | "low"
      | "high";
  };
};

type MultimodalMessage = {
  role: MessageRole;

  content:
    | string
    | Array<
        | {
            type: "text";
            text: string;
          }
        | ImageContentPart
      >;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":
    "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Content-Type":
    "application/json",
};

function json(
  body: Record<
    string,
    unknown
  >,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers:
        CORS_HEADERS,
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
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (!token) {
    return null;
  }

  const {
    data,
    error,
  } =
    await getAdminClient().auth.getUser(
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
): TextMessage[] {
  if (
    !Array.isArray(value)
  ) {
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
          item.content
            .trim()
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

function parseGenerationType(
  value: unknown,
): GenerationType {
  if (
    value === "chat" ||
    value === "code" ||
    value === "vision"
  ) {
    return value;
  }

  throw new Error(
    "Invalid generation type.",
  );
}

function normalizeImageUrl(
  value: unknown,
): string | undefined {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const imageUrl =
    value.trim();

  if (!imageUrl) {
    return undefined;
  }

  if (
    imageUrl.length >
    MAX_IMAGE_URL_LENGTH
  ) {
    throw new Error(
      "Image URL or data is too large.",
    );
  }

  /*
   * Supported image sources:
   *
   * https://...
   * http://...
   * data:image/...
   */
  if (
    imageUrl.startsWith(
      "https://",
    ) ||
    imageUrl.startsWith(
      "http://",
    ) ||
    imageUrl.startsWith(
      "data:image/",
    )
  ) {
    return imageUrl;
  }

  throw new Error(
    "imageUrl must be an HTTP(S) URL or image data URL.",
  );
}

function buildOpenAIMessages(
  systemPrompt: string,
  messages: TextMessage[],
  generationType: GenerationType,
  imageUrl?: string,
): MultimodalMessage[] {
  const output:
    MultimodalMessage[] = [
    {
      role: "system",

      content:
        systemPrompt,
    },

    ...messages,
  ];

  /*
   * Normal chat/code does not need multimodal
   * content.
   */
  if (
    generationType !==
    "vision"
  ) {
    return output;
  }

  /*
   * Vision must have an image.
   */
  if (!imageUrl) {
    throw new Error(
      "imageUrl is required for vision generation.",
    );
  }

  /*
   * Find the last user message.
   */
  let lastUserIndex =
    -1;

  for (
    let index =
      output.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      output[index]?.role ===
      "user"
    ) {
      lastUserIndex =
        index;

      break;
    }
  }

  if (
    lastUserIndex < 0
  ) {
    throw new Error(
      "A user message is required for vision generation.",
    );
  }

  const userMessage =
    output[
      lastUserIndex
    ];

  const text =
    typeof userMessage.content ===
    "string"
      ? userMessage.content
      : "Analyze the supplied image.";

  /*
   * This is the critical Vision part:
   *
   * text + image_url are sent together
   * in the same user message.
   */
  output[
    lastUserIndex
  ] = {
    role: "user",

    content: [
      {
        type: "text",

        text,
      },

      {
        type: "image_url",

        image_url: {
          url: imageUrl,

          detail: "auto",
        },
      },
    ],
  };

  return output;
}

Deno.serve(
  async (req) => {
    /*
     * CORS.
     */
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

    /*
     * Only POST.
     */
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

    let generationId =
      "";

    let userId =
      "";

    let generationType:
      GenerationType =
        "chat";

    try {
      /*
       * OpenAI API key must exist.
       */
      if (
        !OPENAI_API_KEY
      ) {
        return json(
          {
            success:
              false,

            error:
              "OPENAI_API_KEY is not configured.",
          },
          500,
        );
      }

      /*
       * Authenticate user.
       */
      const user =
        await requireUser(
          req,
        );

      if (!user) {
        return json(
          {
            success:
              false,

            error:
              "Authentication required.",
          },
          401,
        );
      }

      userId =
        user.id;

      /*
       * Parse body.
       */
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
            success:
              false,

            error:
              "Invalid JSON request body.",
          },
          400,
        );
      }

      /*
       * Generation ID.
       */
      generationId =
        typeof body.generationId ===
        "string"
          ? body.generationId
              .trim()
          : "";

      if (
        !generationId
      ) {
        return json(
          {
            success:
              false,

            error:
              "Generation ID is required.",
          },
          400,
        );
      }

      /*
       * Generation type.
       */
      generationType =
        parseGenerationType(
          body.generationType,
        );

      /*
       * Optional image.
       */
      const imageUrl =
        normalizeImageUrl(
          body.imageUrl,
        );

      /*
       * Vision requires image.
       */
      if (
        generationType ===
          "vision" &&
        !imageUrl
      ) {
        return json(
          {
            success:
              false,

            error:
              "imageUrl is required for vision generation.",
          },
          400,
        );
      }

      /*
       * Image is not allowed for regular
       * chat/code.
       */
      if (
        generationType !==
          "vision" &&
        imageUrl
      ) {
        return json(
          {
            success:
              false,

            error:
              "imageUrl is only allowed for vision generation.",
          },
          400,
        );
      }

      /*
       * Verify:
       *
       * generation exists
       * belongs to authenticated user
       * type matches request
       */
      await getGenerationForUser(
        generationId,
        userId,
        generationType,
      );

      /*
       * Normalize messages.
       */
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
            success:
              false,

            error:
              "At least one message is required.",
          },
          400,
        );
      }

      /*
       * System prompt.
       */
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

      /*
       * Model selection.
       *
       * Vision:
       *   OPENAI_VISION_MODEL
       *
       * Code:
       *   OPENAI_CODE_MODEL
       *
       * Chat:
       *   OPENAI_CHAT_MODEL
       *
       * fallback:
       *   OPENAI_MODEL
       *
       * final fallback:
       *   gpt-5.6
       */
      const requestedModel =
        typeof body.model ===
        "string"
          ? body.model.trim()
          : "";

      const model =
        requestedModel ||
        (
          generationType ===
          "vision"
            ? Deno.env.get(
                "OPENAI_VISION_MODEL",
              )
            : generationType ===
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
        "gpt-5.6";

      /*
       * Temperature.
       */
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

      /*
       * Token limit.
       *
       * Client sends max_tokens.
       * OpenAI request uses
       * max_completion_tokens.
       */
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

      /*
       * Top P.
       */
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
       * Claim generation.
       *
       * queued -> processing
       */
      await updateGeneration({
        generationId,

        userId,

        status:
          "processing",

        expectedType:
          generationType,
      });

      /*
       * Construct OpenAI request.
       */
      const requestBody:
        Record<
          string,
          unknown
        > = {
        model,

        messages:
          buildOpenAIMessages(
            systemPrompt,
            messages,
            generationType,
            imageUrl,
          ),
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
        requestBody.max_completion_tokens =
          maxTokens;
      }

      if (
        topP !== undefined
      ) {
        requestBody.top_p =
          topP;
      }

      /*
       * Call OpenAI.
       */
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

            body: JSON.stringify(
              requestBody,
            ),
          },
        );

      /*
       * Read raw response first.
       */
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

      /*
       * OpenAI error.
       */
      if (
        !response.ok
      ) {
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

      /*
       * Extract choices.
       */
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

      const rawContent =
        choiceMessage &&
        typeof choiceMessage ===
          "object"
          ? (
              choiceMessage as {
                content?: unknown;
              }
            ).content
          : undefined;

      /*
       * OpenAI may return:
       *
       * string
       *
       * or content parts.
       */
      const text =
        typeof rawContent ===
        "string"
          ? rawContent
          : Array.isArray(
                rawContent,
              )
            ? rawContent
                .filter(
                  (part) =>
                    part &&
                    typeof part ===
                      "object" &&
                    (
                      part as Record<
                        string,
                        unknown
                      >
                    ).type ===
                      "text",
                )
                .map(
                  (part) =>
                    String(
                      (
                        part as Record<
                          string,
                          unknown
                        >
                      ).text ??
                        "",
                    ),
                )
                .join("\n")
            : "";

      /*
       * Empty response is treated as failure.
       */
      if (
        !text.trim()
      ) {
        throw new Error(
          "OpenAI returned an empty response.",
        );
      }

      /*
       * Usage information.
       */
      const usage =
        result.usage &&
        typeof result.usage ===
          "object"
          ? result.usage
          : undefined;

      /*
       * Save completed generation.
       */
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

      /*
       * Return successful response.
       */
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
        error instanceof
        Error
          ? error.message
          : "OpenAI generation failed.";

      /*
       * Try to mark generation as failed.
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
          success:
            false,

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
