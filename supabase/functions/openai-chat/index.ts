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

const GEMINI_API_KEY =
  Deno.env.get(
    "GEMINI_API_KEY",
  ) ?? "";

const GEMINI_CHAT_MODEL =
  Deno.env.get(
    "GEMINI_CHAT_MODEL",
  ) ??
  "gemini-3.8-flash";

const GEMINI_VISION_MODEL =
  Deno.env.get(
    "GEMINI_VISION_MODEL",
  ) ??
  "gemini-3.8-flash";

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

type GeminiPart = {
  text?: string;

  inlineData?: {
    mimeType: string;
    data: string;
  };
};

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiPart[];
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

function getSystemPrompt(
  body: Record<
    string,
    unknown
  >,
): string {
  if (
    typeof body.systemPrompt ===
      "string" &&
    body.systemPrompt.trim()
  ) {
    return body.systemPrompt
      .trim()
      .slice(
        0,
        MAX_CONTENT_LENGTH,
      );
  }

  return DEFAULT_SYSTEM_PROMPT;
}

function convertRole(
  role: MessageRole,
): "user" | "model" {
  return role ===
    "assistant"
    ? "model"
    : "user";
}

function dataUrlToInlineData(
  imageUrl: string,
) {
  const match =
    imageUrl.match(
      /^data:(image\/[^;]+);base64,(.+)$/s,
    );

  if (!match) {
    throw new Error(
      "Invalid image data URL.",
    );
  }

  return {
    mimeType:
      match[1],
    data:
      match[2],
  };
}

async function urlToInlineData(
  imageUrl: string,
) {
  const response =
    await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      "Unable to download image for vision request.",
    );
  }

  const contentType =
    response.headers.get(
      "content-type",
    ) ?? "image/jpeg";

  if (
    !contentType.startsWith(
      "image/",
    )
  ) {
    throw new Error(
      "The supplied URL does not contain an image.",
    );
  }

  const bytes =
    new Uint8Array(
      await response.arrayBuffer(),
    );

  if (
    bytes.length >
    MAX_IMAGE_URL_LENGTH
  ) {
    throw new Error(
      "Image is too large.",
    );
  }

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary +=
      String.fromCharCode(
        ...bytes.subarray(
          i,
          Math.min(
            i + chunkSize,
            bytes.length,
          ),
        ),
      );
  }

  return {
    mimeType:
      contentType,
    data:
      btoa(binary),
  };
}

async function imageToInlineData(
  imageUrl: string,
) {
  if (
    imageUrl.startsWith(
      "data:image/",
    )
  ) {
    return dataUrlToInlineData(
      imageUrl,
    );
  }

  return urlToInlineData(
    imageUrl,
  );
}

function buildGeminiContents(
  messages: TextMessage[],
): GeminiContent[] {
  return messages.map(
    (message) => ({
      role:
        convertRole(
          message.role,
        ),

      parts: [
        {
          text:
            message.content,
        },
      ],
    }),
  );
}

async function addVisionImage(
  contents: GeminiContent[],
  imageUrl: string,
) {
  let lastUser =
    -1;

  for (
    let index =
      contents.length - 1;
    index >= 0;
    index -= 1
  ) {
    if (
      contents[index]?.role ===
      "user"
    ) {
      lastUser =
        index;
      break;
    }
  }

  if (
    lastUser < 0
  ) {
    throw new Error(
      "A user message is required for vision generation.",
    );
  }

  const image =
    await imageToInlineData(
      imageUrl,
    );

  contents[
    lastUser
  ].parts.push({
    inlineData: {
      mimeType:
        image.mimeType,
      data:
        image.data,
    },
  });
}

function getMaxOutputTokens(
  generationType: GenerationType,
  value: unknown,
): number {
  if (
    typeof value ===
      "number" &&
    Number.isInteger(value)
  ) {
    return Math.max(
      1,
      Math.min(
        32000,
        value,
      ),
    );
  }

  if (
    generationType ===
    "code"
  ) {
    return 8000;
  }

  if (
    generationType ===
    "vision"
  ) {
    return 4000;
  }

  return 4000;
}

function getTemperature(
  value: unknown,
) {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(
      0,
      Math.min(
        2,
        value,
      ),
    );
  }

  return 0.7;
}

function getTopP(
  value: unknown,
) {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(
      0,
      Math.min(
        1,
        value,
      ),
    );
  }

  return 0.95;
}

async function callGemini(
  model: string,
  systemPrompt: string,
  contents: GeminiContent[],
  generationType: GenerationType,
  maxOutputTokens: number,
  temperature: number,
  topP: number,
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured.",
    );
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent`;

  const response =
    await fetch(
      endpoint,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            GEMINI_API_KEY,
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  systemPrompt,
              },
            ],
          },

          contents,

          generationConfig: {
            temperature,
            topP,
            maxOutputTokens,

            ...(generationType ===
              "vision"
              ? {}
              : {}),
          },
        }),
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
        : `Gemini API request failed (${response.status}).`,
    );
  }

  return result;
}

function extractGeminiText(
  result: Record<
    string,
    unknown
  >,
): string {
  const candidates =
    Array.isArray(
      result.candidates,
    )
      ? result.candidates
      : [];

  const firstCandidate =
    candidates[0];

  if (
    !firstCandidate ||
    typeof firstCandidate !==
      "object"
  ) {
    return "";
  }

  const content =
    (
      firstCandidate as {
        content?: unknown;
      }
    ).content;

  if (
    !content ||
    typeof content !==
      "object"
  ) {
    return "";
  }

  const parts =
    Array.isArray(
      (
        content as {
          parts?: unknown;
        }
      ).parts,
    )
      ? (
          content as {
            parts: unknown[];
          }
        ).parts
      : [];

  return parts
    .filter(
      (part) =>
        part &&
        typeof part ===
          "object" &&
        typeof (
          part as {
            text?: unknown;
          }
        ).text ===
          "string",
    )
    .map(
      (part) =>
        String(
          (
            part as {
              text: string;
            }
          ).text,
        ),
    )
    .join("\n")
    .trim();
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
          success:
            false,

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
       * Gemini API key must exist.
       */
      if (
        !GEMINI_API_KEY
      ) {
        return json(
          {
            success:
              false,

            error:
              "GEMINI_API_KEY is not configured.",
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
       * Image is not allowed for
       * regular chat/code.
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
       * Verify generation:
       *
       * - exists
       * - belongs to user
       * - type matches
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
        getSystemPrompt(
          body,
        );

      /*
       * Gemini model.
       *
       * We do not accept arbitrary
       * client-selected provider models.
       * This prevents a client from
       * bypassing the server model policy.
       */
      const model =
        generationType ===
        "vision"
          ? GEMINI_VISION_MODEL
          : GEMINI_CHAT_MODEL;

      /*
       * Generation settings.
       */
      const temperature =
        getTemperature(
          body.temperature,
        );

      const topP =
        getTopP(
          body.top_p,
        );

      const maxOutputTokens =
        getMaxOutputTokens(
          generationType,
          body.max_tokens,
        );

      /*
       * Convert OpenAI-style messages
       * already used by the mobile app
       * into Gemini contents.
       */
      const contents =
        buildGeminiContents(
          messages,
        );

      /*
       * Add image to the last user
       * message for Vision.
       */
      if (
        generationType ===
          "vision" &&
        imageUrl
      ) {
        await addVisionImage(
          contents,
          imageUrl,
        );
      }

      /*
       * Claim generation:
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
       * Call Gemini.
       */
      const result =
        await callGemini(
          model,
          systemPrompt,
          contents,
          generationType,
          maxOutputTokens,
          temperature,
          topP,
        );

      /*
       * Extract generated text.
       */
      const text =
        extractGeminiText(
          result,
        );

      /*
       * Empty response is failure.
       */
      if (
        !text.trim()
      ) {
        throw new Error(
          "Gemini returned an empty response.",
        );
      }

      /*
       * Usage information.
       *
       * Gemini returns:
       *
       * usageMetadata
       */
      const usage =
        result.usageMetadata &&
        typeof result.usageMetadata ===
          "object"
          ? result.usageMetadata
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
          "gemini",

        model,

        resultText:
          text.trim(),

        usage,

        expectedType:
          generationType,
      });

      /*
       * Return successful response.
       *
       * Keep the same response shape
       * used by the existing mobile app:
       *
       * success
       * generationId
       * text
       * model
       * usage
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
          : "Gemini generation failed.";

      /*
       * Try to mark generation
       * as failed.
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
        "openai-chat Gemini error:",
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
