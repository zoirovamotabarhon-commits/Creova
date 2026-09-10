import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import {
  getGenerationForUser,
  updateGeneration,
  storeAssetAndGetSignedUrl,
} from "../_shared/generation.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY") ?? "";

const IMAGE_MODEL =
  Deno.env.get("OPENAI_IMAGE_MODEL") ??
  "gpt-image-1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type": "application/json",
};

type ImageSize =
  | "1024x1024"
  | "1536x1024"
  | "1024x1536"
  | "auto";

function response(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
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

async function getUser(
  request: Request,
) {
  const authorization =
    request.headers.get(
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

function isValidSize(
  value: unknown,
): value is ImageSize {
  return (
    value === "1024x1024" ||
    value === "1536x1024" ||
    value === "1024x1536" ||
    value === "auto"
  );
}

function extractImageBase64(
  result: unknown,
): string | null {
  if (
    !result ||
    typeof result !== "object"
  ) {
    return null;
  }

  const data =
    (
      result as {
        data?: unknown;
      }
    ).data;

  if (!Array.isArray(data)) {
    return null;
  }

  const first =
    data[0];

  if (
    !first ||
    typeof first !== "object"
  ) {
    return null;
  }

  const image =
    first as {
      b64_json?: unknown;
    };

  return typeof image.b64_json ===
    "string"
    ? image.b64_json
    : null;
}

Deno.serve(
  async (request) => {
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      request.method !==
      "POST"
    ) {
      return response(
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

    try {
      if (!OPENAI_API_KEY) {
        return response(
          {
            success: false,
            error:
              "OPENAI_API_KEY is not configured.",
          },
          500,
        );
      }

      const user =
        await getUser(
          request,
        );

      if (!user) {
        return response(
          {
            success: false,
            error:
              "Authentication required.",
          },
          401,
        );
      }

      userId =
        user.id;

      let body:
        Record<
          string,
          unknown
        >;

      try {
        body =
          (await request.json()) as Record<
            string,
            unknown
          >;
      } catch {
        return response(
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
        return response(
          {
            success: false,
            error:
              "Generation ID is required.",
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
        return response(
          {
            success: false,
            error:
              "Image prompt is required.",
          },
          400,
        );
      }

      if (
        prompt.length >
        10000
      ) {
        return response(
          {
            success: false,
            error:
              "Image prompt is too long.",
          },
          400,
        );
      }

      const size: ImageSize =
        isValidSize(
          body.size,
        )
          ? body.size
          : "1024x1024";

      /*
       * Verify ownership and generation type
       * before contacting the paid provider.
       */
      await getGenerationForUser(
        generationId,
        userId,
        "image",
      );

      /*
       * Claim the generation.
       *
       * Only the request that successfully changes
       * queued -> processing is allowed to call OpenAI.
       */
      await updateGeneration({
        generationId,
        userId,
        status:
          "processing",
        expectedType:
          "image",
      });

      const openAIResponse =
        await fetch(
          "https://api.openai.com/v1/images/generations",
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
              JSON.stringify({
                model:
                  IMAGE_MODEL,

                prompt,

                size,

                response_format:
                  "b64_json",
              }),
          },
        );

      const raw =
        await openAIResponse.text();

      let result:
        Record<
          string,
          unknown
        > = {};

      try {
        result =
          raw
            ? (JSON.parse(
                raw,
              ) as Record<
                string,
                unknown
              >)
            : {};
      } catch {
        result = {
          raw,
        };
      }

      if (
        !openAIResponse.ok
      ) {
        const errorObject =
          result.error;

        const errorMessage =
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
          typeof errorMessage ===
            "string"
            ? errorMessage
            : "OpenAI image generation failed.",
        );
      }

      const base64 =
        extractImageBase64(
          result,
        );

      if (!base64) {
        throw new Error(
          "OpenAI did not return image data.",
        );
      }

      /*
       * Decode base64 and store the image in a PRIVATE
       * Supabase Storage bucket.
       *
       * The client receives only a temporary signed URL.
       */
      const binary =
        Uint8Array.from(
          atob(base64),
          (character) =>
            character.charCodeAt(
              0,
            ),
        );

      const assetUrl =
        await storeAssetAndGetSignedUrl({
          bucket:
            "generation-assets",

          path:
            `${userId}/${generationId}.png`,

          data:
            binary,

          contentType:
            "image/png",

          expiresIn:
            60 * 60,
        });

      await updateGeneration({
        generationId,
        userId,
        status:
          "completed",
        provider:
          "openai",
        model:
          IMAGE_MODEL,
        resultText:
          assetUrl,
        metadata: {
          assetType:
            "image",
          assetUrl,
          size,
        },
        expectedType:
          "image",
      });

      return response({
        success: true,

        generationId,

        url:
          assetUrl,

        imageUrl:
          assetUrl,

        model:
          IMAGE_MODEL,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Image generation failed.";

      /*
       * updateGeneration() handles the failed state
       * and refund logic when appropriate.
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
              "image",
          });
        } catch (
          updateError
        ) {
          console.error(
            "Failed to update image generation:",
            updateError,
          );
        }
      }

      console.error(
        "image-generate error:",
        error,
      );

      return response(
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
