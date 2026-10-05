import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ?? "";

const IMAGE_MODEL =
  Deno.env.get("GEMINI_IMAGE_MODEL") ??
  "gemini-3.1-flash-image";

const CORS_HEADERS = {
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

// ---- inlined from _shared/generation.ts (standalone - no cross-function import) ----

type SharedGenerationType =
  | "chat" | "code" | "image" | "video" | "music" | "voice" | "vision";

type SharedGenerationStatus =
  | "queued" | "processing" | "completed" | "failed" | "cancelled";

async function sharedGetGeneration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  generationId: string,
  expectedType?: SharedGenerationType,
) {
  const { data, error } = await supabase
    .from("generation_history")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Generation not found");

  if (expectedType && data.type !== expectedType) {
    throw new Error(
      `Generation type mismatch: expected ${expectedType}, got ${data.type}`,
    );
  }

  return data;
}

function sharedAssertCanStart(generation: { status: string }) {
  if (generation.status !== "queued") {
    throw new Error(
      `Generation cannot start from status "${generation.status}"`,
    );
  }
}

function sharedAssertCanUpdate(generation: { status: string }) {
  if (
    generation.status === "completed" ||
    generation.status === "failed" ||
    generation.status === "cancelled"
  ) {
    throw new Error(`Generation is already terminal: ${generation.status}`);
  }
}

async function getGenerationForUser(
  generationId: string,
  userId: string,
  expectedType?: SharedGenerationType,
) {
  return sharedGetGeneration(
    getAdminClient(),
    userId,
    generationId,
    expectedType,
  );
}

async function updateGeneration(input: {
  generationId: string;
  userId: string;
  status: SharedGenerationStatus;
  expectedType?: SharedGenerationType;
  provider?: string;
  model?: string;
  resultText?: string;
  resultUrl?: string;
  errorMessage?: string;
  usage?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getAdminClient();
  const {
    generationId, userId, status, expectedType,
    provider, model, resultText, resultUrl, errorMessage, usage, metadata,
  } = input;

  const current = await sharedGetGeneration(
    supabase, userId, generationId, expectedType,
  );

  if (status === "processing") {
    sharedAssertCanStart(current);

    const { data, error } = await supabase
      .from("generation_history")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", generationId)
      .eq("user_id", userId)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error("Generation was already claimed or is no longer available");
    }
    return data;
  }

  sharedAssertCanUpdate(current);

  const mergedMetadata = {
    ...((current.metadata as Record<string, unknown>) ?? {}),
    ...(metadata ?? {}),
    ...(usage ? { usage } : {}),
  };

  const update: Record<string, unknown> = {
    status,
    metadata: mergedMetadata,
    updated_at: new Date().toISOString(),
  };

  if (provider !== undefined) update.provider = provider;
  if (model !== undefined) update.model = model;
  if (resultText !== undefined) update.result_text = resultText;
  if (resultUrl !== undefined) update.result_url = resultUrl;
  if (errorMessage !== undefined) update.error_message = errorMessage;

  if (status === "completed" || status === "failed" || status === "cancelled") {
    update.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("generation_history")
    .update(update)
    .eq("id", generationId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Generation not found while updating.");

  return data;
}

async function storeAssetAndGetSignedUrl(input: {
  bucket: string;
  path: string;
  data: Uint8Array | ArrayBuffer;
  contentType: string;
  expiresIn?: number;
}) {
  const supabase = getAdminClient();
  const { bucket, path, data, contentType, expiresIn = 60 * 60 } = input;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, data, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`Asset upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (signError || !signed?.signedUrl) {
    throw new Error(
      signError?.message ?? "Unable to create a signed URL for the asset.",
    );
  }

  return { url: signed.signedUrl, path };
}

// ---- end inlined ----

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

function imageConfig(
  size: ImageSize,
) {
  switch (size) {
    case "1536x1024":
      return {
        aspectRatio: "3:2",
        imageSize: "1K",
      };

    case "1024x1536":
      return {
        aspectRatio: "2:3",
        imageSize: "1K",
      };

    case "auto":
      return {
        aspectRatio: "1:1",
        imageSize: "1K",
      };

    case "1024x1024":
    default:
      return {
        aspectRatio: "1:1",
        imageSize: "1K",
      };
  }
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

  const candidates =
    (
      result as {
        candidates?: unknown;
      }
    ).candidates;

  if (
    !Array.isArray(
      candidates,
    )
  ) {
    return null;
  }

  for (
    const candidate of candidates
  ) {
    if (
      !candidate ||
      typeof candidate !== "object"
    ) {
      continue;
    }

    const content =
      (
        candidate as {
          content?: unknown;
        }
      ).content;

    if (
      !content ||
      typeof content !== "object"
    ) {
      continue;
    }

    const parts =
      (
        content as {
          parts?: unknown;
        }
      ).parts;

    if (
      !Array.isArray(parts)
    ) {
      continue;
    }

    for (
      const part of parts
    ) {
      if (
        !part ||
        typeof part !== "object"
      ) {
        continue;
      }

      const inlineData =
        (
          part as {
            inlineData?: unknown;
          }
        ).inlineData;

      if (
        !inlineData ||
        typeof inlineData !== "object"
      ) {
        continue;
      }

      const data =
        (
          inlineData as {
            data?: unknown;
          }
        ).data;

      if (
        typeof data === "string" &&
        data.length > 0
      ) {
        return data;
      }
    }
  }

  return null;
}

async function callGeminiImage(
  prompt: string,
  size: ImageSize,
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured.",
    );
  }

  const config =
    imageConfig(size);

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      IMAGE_MODEL,
    )}:generateContent`;

  const apiResponse =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            GEMINI_API_KEY,
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],

          generationConfig: {
            responseModalities: [
              "IMAGE",
            ],

            imageConfig: {
              aspectRatio:
                config.aspectRatio,

              imageSize:
                config.imageSize,
            },
          },
        }),
      },
    );

  const raw =
    await apiResponse.text();

  let data:
    Record<string, unknown> = {};

  try {
    data = raw
      ? JSON.parse(raw)
      : {};
  } catch {
    data = {
      raw,
    };
  }

  if (
    !apiResponse.ok
  ) {
    const errorObject =
      data.error;

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
      typeof message === "string"
        ? message
        : `Gemini image generation failed (${apiResponse.status}).`,
    );
  }

  return data;
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
            CORS_HEADERS,
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
      if (!GEMINI_API_KEY) {
        return response(
          {
            success: false,
            error:
              "GEMINI_API_KEY is not configured.",
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
        Record<string, unknown>;

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
        prompt.length > 10000
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

      await getGenerationForUser(
        generationId,
        userId,
        "image",
      );

      await updateGeneration({
        generationId,
        userId,
        status:
          "processing",
        expectedType:
          "image",
      });

      const result =
        await callGeminiImage(
          prompt,
          size,
        );

      const base64 =
        extractImageBase64(
          result,
        );

      if (!base64) {
        throw new Error(
          "Gemini did not return image data.",
        );
      }

      const binary =
        Uint8Array.from(
          atob(base64),
          (character) =>
            character.charCodeAt(
              0,
            ),
        );

      const {
        url: assetUrl,
      } =
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
          "gemini",
        model:
          IMAGE_MODEL,
        resultText:
          assetUrl,
        metadata: {
          assetType:
            "image",

          assetUrl,

          size,

          provider:
            "gemini",
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
        "image-generate Gemini error:",
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
