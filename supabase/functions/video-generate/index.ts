import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

import {
  getGenerationForUser,
  updateGeneration,
} from "../_shared/generation.ts";

const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ?? "";

const GEMINI_VIDEO_MODEL =
  Deno.env.get("GEMINI_VIDEO_MODEL") ??
  "veo-3.1-lite-generate-preview";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const VIDEO_BUCKET =
  "videos";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Content-Type":
    "application/json",
};

type JsonObject =
  Record<string, unknown>;

function json(
  body: JsonObject,
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

function admin() {
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
      .slice(7)
      .trim();

  if (!token) {
    return null;
  }

  const {
    data,
    error,
  } =
    await admin().auth.getUser(
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

async function ensureVideoBucket() {
  const client =
    admin();

  const {
    data,
    error,
  } =
    await client.storage.listBuckets();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  if (
    data?.some(
      (bucket) =>
        bucket.name ===
        VIDEO_BUCKET,
    )
  ) {
    return;
  }

  const {
    error:
      createError,
  } =
    await client.storage.createBucket(
      VIDEO_BUCKET,
      {
        public: false,

        allowedMimeTypes: [
          "video/mp4",
        ],
      },
    );

  if (
    createError &&
    !createError.message
      .toLowerCase()
      .includes(
        "already exists",
      )
  ) {
    throw new Error(
      createError.message,
    );
  }
}

async function geminiRequest(
  url: string,
  init: RequestInit,
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured.",
    );
  }

  const headers =
    new Headers(
      init.headers,
    );

  headers.set(
    "x-goog-api-key",
    GEMINI_API_KEY,
  );

  headers.set(
    "Content-Type",
    "application/json",
  );

  return fetch(
    url,
    {
      ...init,
      headers,
    },
  );
}

async function parseJson(
  response: Response,
): Promise<JsonObject> {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text,
    ) as JsonObject;
  } catch {
    return {
      raw: text,
    };
  }
}

function apiError(
  data: JsonObject,
  fallback: string,
) {
  if (
    data.error &&
    typeof data.error ===
      "object"
  ) {
    const message =
      (
        data.error as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message ===
      "string"
    ) {
      return message;
    }
  }

  if (
    typeof data.raw ===
    "string"
  ) {
    return data.raw;
  }

  return fallback;
}

async function createVideo(
  prompt: string,
) {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_VIDEO_MODEL,
    )}:predictLongRunning`;

  const response =
    await geminiRequest(
      endpoint,
      {
        method:
          "POST",

        body: JSON.stringify({
          instances: [
            {
              prompt,
            },
          ],

          parameters: {
            numberOfVideos:
              1,

            resolution:
              "720p",

            aspectRatio:
              "16:9",
          },
        }),
      },
    );

  const data =
    await parseJson(
      response,
    );

  if (
    !response.ok
  ) {
    throw new Error(
      apiError(
        data,
        `Gemini video generation failed (${response.status}).`,
      ),
    );
  }

  const operationName =
    typeof data.name ===
    "string"
      ? data.name
      : "";

  if (!operationName) {
    throw new Error(
      "Gemini did not return an operation name.",
    );
  }

  return {
    operationName,
    data,
  };
}

async function getOperation(
  operationName: string,
) {
  const normalized =
    operationName.startsWith(
      "http",
    )
      ? operationName
      : `https://generativelanguage.googleapis.com/v1beta/${operationName}`;

  const response =
    await geminiRequest(
      normalized,
      {
        method:
          "GET",
      },
    );

  const data =
    await parseJson(
      response,
    );

  if (
    !response.ok
  ) {
    throw new Error(
      apiError(
        data,
        `Unable to retrieve Gemini video operation (${response.status}).`,
      ),
    );
  }

  return data;
}

function extractVideoUri(
  data: JsonObject,
): string | null {
  const response =
    data.response;

  if (
    !response ||
    typeof response !==
      "object"
  ) {
    return null;
  }

  const videoResponse =
    (
      response as {
        generateVideoResponse?: unknown;
      }
    ).generateVideoResponse;

  if (
    videoResponse &&
    typeof videoResponse ===
      "object"
  ) {
    const samples =
      (
        videoResponse as {
          generatedSamples?: unknown;
        }
      ).generatedSamples;

    if (
      Array.isArray(
        samples,
      )
    ) {
      const first =
        samples[0];

      if (
        first &&
        typeof first ===
          "object"
      ) {
        const video =
          (
            first as {
              video?: unknown;
            }
          ).video;

        if (
          video &&
          typeof video ===
            "object"
        ) {
          const uri =
            (
              video as {
                uri?: unknown;
              }
            ).uri;

          if (
            typeof uri ===
            "string"
          ) {
            return uri;
          }
        }
      }
    }
  }

  const generatedVideos =
    (
      response as {
        generatedVideos?: unknown;
      }
    ).generatedVideos;

  if (
    Array.isArray(
      generatedVideos,
    )
  ) {
    const first =
      generatedVideos[0];

    if (
      first &&
      typeof first ===
        "object"
    ) {
      const video =
        (
          first as {
            video?: unknown;
          }
        ).video;

      if (
        video &&
        typeof video ===
          "object"
      ) {
        const uri =
          (
            video as {
              uri?: unknown;
            }
          ).uri;

        if (
          typeof uri ===
          "string"
        ) {
          return uri;
        }
      }
    }
  }

  return null;
}

async function downloadVideo(
  uri: string,
) {
  const response =
    await geminiRequest(
      uri,
      {
        method:
          "GET",
      },
    );

  if (
    !response.ok
  ) {
    const data =
      await parseJson(
        response,
      );

    throw new Error(
      apiError(
        data,
        `Video download failed (${response.status}).`,
      ),
    );
  }

  const buffer =
    await response.arrayBuffer();

  if (
    buffer.byteLength ===
    0
  ) {
    throw new Error(
      "Downloaded video is empty.",
    );
  }

  return buffer;
}

async function storeVideo(
  videoId: string,
  operation: JsonObject,
) {
  const uri =
    extractVideoUri(
      operation,
    );

  if (!uri) {
    throw new Error(
      "Gemini completed the operation but did not return a video URI.",
    );
  }

  const buffer =
    await downloadVideo(
      uri,
    );

  await ensureVideoBucket();

  const path =
    `${crypto.randomUUID()}.mp4`;

  const {
    error:
      uploadError,
  } =
    await admin()
      .storage
      .from(
        VIDEO_BUCKET,
      )
      .upload(
        path,
        buffer,
        {
          contentType:
            "video/mp4",

          upsert:
            false,
        },
      );

  if (uploadError) {
    throw new Error(
      `Video upload failed: ${uploadError.message}`,
    );
  }

  const {
    data,
    error:
      signedError,
  } =
    await admin()
      .storage
      .from(
        VIDEO_BUCKET,
      )
      .createSignedUrl(
        path,
        60 * 60,
      );

  if (
    signedError ||
    !data?.signedUrl
  ) {
    throw new Error(
      signedError?.message ??
        "Unable to create signed video URL.",
    );
  }

  return {
    url:
      data.signedUrl,

    path,

    videoId,
  };
}

async function saveVideoMetadata(
  generationId: string,
  userId: string,
  videoId: string,
) {
  const {
    data,
    error,
  } =
    await admin()
      .from(
        "generation_history",
      )
      .select(
        "metadata",
      )
      .eq(
        "id",
        generationId,
      )
      .eq(
        "user_id",
        userId,
      )
      .single();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  const metadata =
    data?.metadata &&
    typeof data.metadata ===
      "object" &&
    !Array.isArray(
      data.metadata,
    )
      ? data.metadata as Record<
          string,
          unknown
        >
      : {};

  const {
    error:
      updateError,
  } =
    await admin()
      .from(
        "generation_history",
      )
      .update({
        metadata: {
          ...metadata,

          videoId,

          provider:
            "gemini",

          model:
            GEMINI_VIDEO_MODEL,
        },
      })
      .eq(
        "id",
        generationId,
      )
      .eq(
        "user_id",
        userId,
      );

  if (updateError) {
    throw new Error(
      updateError.message,
    );
  }
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

    let generationId =
      "";

    let userId =
      "";

    try {
      if (!GEMINI_API_KEY) {
        return json(
          {
            success: false,
            error:
              "GEMINI_API_KEY is not configured.",
          },
          500,
        );
      }

      const currentUser =
        await getUser(
          req,
        );

      if (!currentUser) {
        return json(
          {
            success: false,
            error:
              "Authentication required.",
          },
          401,
        );
      }

      userId =
        currentUser.id;

      const body =
        (await req.json()) as JsonObject;

      const action =
        typeof body.action ===
        "string"
          ? body.action.trim()
          : "";

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

      if (
        action ===
        "create"
      ) {
        const prompt =
          typeof body.prompt ===
          "string"
            ? body.prompt.trim()
            : "";

        if (!prompt) {
          return json(
            {
              success: false,
              error:
                "Video prompt is required.",
            },
            400,
          );
        }

        if (
          prompt.length >
          10000
        ) {
          return json(
            {
              success: false,
              error:
                "Video prompt is too long.",
            },
            400,
          );
        }

        await getGenerationForUser(
          generationId,
          userId,
          "video",
        );

        await updateGeneration({
          generationId,
          userId,
          status:
            "processing",
          expectedType:
            "video",
        });

        const created =
          await createVideo(
            prompt,
          );

        const videoId =
          created.operationName;

        await saveVideoMetadata(
          generationId,
          userId,
          videoId,
        );

        return json({
          success: true,

          generationId,

          videoId,

          status:
            "processing",

          progress:
            0,

          model:
            GEMINI_VIDEO_MODEL,
        });
      }

      if (
        action ===
        "status"
      ) {
        const videoId =
          typeof body.videoId ===
          "string"
            ? body.videoId.trim()
            : "";

        if (!videoId) {
          return json(
            {
              success: false,
              error:
                "Video ID is required.",
            },
            400,
          );
        }

        await getGenerationForUser(
          generationId,
          userId,
          "video",
        );

        const operation =
          await getOperation(
            videoId,
          );

        if (
          operation.error
        ) {
          throw new Error(
            apiError(
              operation,
              "Gemini video operation failed.",
            ),
          );
        }

        if (
          operation.done ===
          true
        ) {
          const error =
            operation.error;

          if (error) {
            const message =
              apiError(
                operation,
                "Gemini video generation failed.",
              );

            await updateGeneration({
              generationId,
              userId,
              status:
                "failed",
              provider:
                "gemini",
              model:
                GEMINI_VIDEO_MODEL,
              errorMessage:
                message,
              expectedType:
                "video",
            });

            return json(
              {
                success: false,

                generationId,

                videoId,

                status:
                  "failed",

                progress:
                  0,

                error:
                  message,
              },
              200,
            );
          }

          const stored =
            await storeVideo(
              videoId,
              operation,
            );

          await updateGeneration({
            generationId,
            userId,
            status:
              "completed",
            provider:
              "gemini",
            model:
              GEMINI_VIDEO_MODEL,
            resultUrl:
              stored.url,
            metadata: {
              videoId,

              storageBucket:
                VIDEO_BUCKET,

              storagePath:
                stored.path,

              provider:
                "gemini",
            },
            expectedType:
              "video",
          });

          return json({
            success: true,

            generationId,

            videoId,

            videoUrl:
              stored.url,

            status:
              "completed",

            progress:
              100,

            model:
              GEMINI_VIDEO_MODEL,
          });
        }

        return json({
          success: true,

          generationId,

          videoId,

          status:
            "processing",

          progress:
            50,
        });
      }

      return json(
        {
          success: false,

          error:
            "Unknown action. Use 'create' or 'status'.",
        },
        400,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Video generation failed.";

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
            provider:
              "gemini",
            model:
              GEMINI_VIDEO_MODEL,
            errorMessage:
              message,
            expectedType:
              "video",
          });
        } catch (
          updateError
        ) {
          console.error(
            "Failed to mark video generation as failed:",
            updateError,
          );
        }
      }

      console.error(
        "video-generate Gemini error:",
        error,
      );

      return json(
        {
          success: false,

          generationId:
            generationId ||
            undefined,

          error:
            message,
        },
        500,
      );
    }
  },
);
