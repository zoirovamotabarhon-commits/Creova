import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

import {
  updateGeneration,
} from "../_shared/generation.ts";

const OPENAI_API_KEY =
  Deno.env.get(
    "OPENAI_API_KEY",
  ) ?? "";

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
      .slice(7)
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

async function openAI(
  path: string,
  options: RequestInit = {},
) {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured.",
    );
  }

  const headers =
    new Headers(
      options.headers,
    );

  headers.set(
    "Authorization",
    `Bearer ${OPENAI_API_KEY}`,
  );

  return fetch(
    `https://api.openai.com/v1${path}`,
    {
      ...options,
      headers,
    },
  );
}

async function readJson(
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

function getApiError(
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

async function ensureVideoBucket() {
  const admin =
    getAdminClient();

  const {
    data: buckets,
    error,
  } =
    await admin.storage.listBuckets();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  const exists =
    buckets?.some(
      (bucket) =>
        bucket.name ===
        VIDEO_BUCKET,
    ) ?? false;

  if (exists) {
    return;
  }

  const {
    error: createError,
  } =
    await admin.storage.createBucket(
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

async function storeVideo(
  videoId: string,
): Promise<string> {
  const admin =
    getAdminClient();

  await ensureVideoBucket();

  const response =
    await openAI(
      `/videos/${encodeURIComponent(
        videoId,
      )}/content`,
      {
        method: "GET",
        headers: {
          Accept:
            "video/mp4",
        },
      },
    );

  if (!response.ok) {
    const errorData =
      await readJson(
        response,
      );

    throw new Error(
      getApiError(
        errorData,
        `Video download failed with status ${response.status}.`,
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

  const storagePath =
    `${videoId}.mp4`;

  const {
    error: uploadError,
  } =
    await admin.storage
      .from(VIDEO_BUCKET)
      .upload(
        storagePath,
        buffer,
        {
          contentType:
            "video/mp4",
          upsert: true,
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
      signedUrlError,
  } =
    await admin.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(
        storagePath,
        3600,
      );

  if (
    signedUrlError ||
    !data?.signedUrl
  ) {
    throw new Error(
      signedUrlError?.message ??
        "Unable to create signed video URL.",
    );
  }

  return data.signedUrl;
}

async function saveVideoMetadata(
  generationId: string,
  userId: string,
  videoId: string,
) {
  const admin =
    getAdminClient();

  const {
    data: generation,
    error,
  } =
    await admin
      .from(
        "generation_history",
      )
      .select("metadata")
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
    generation?.metadata &&
    typeof generation.metadata ===
      "object" &&
    !Array.isArray(
      generation.metadata,
    )
      ? generation.metadata as Record<
          string,
          unknown
        >
      : {};

  const {
    error: updateError,
  } =
    await admin
      .from(
        "generation_history",
      )
      .update({
        metadata: {
          ...metadata,
          videoId,
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
      req.method !== "POST"
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

      userId =
        user.id;

      let body: JsonObject;

      try {
        body =
          (await req.json()) as JsonObject;
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
        action === "create"
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

        const generation =
          await getAdminClient()
            .from(
              "generation_history",
            )
            .select("id, user_id, type, status")
            .eq(
              "id",
              generationId,
            )
            .eq(
              "user_id",
              userId,
            )
            .maybeSingle();

        if (
          generation.error
        ) {
          throw new Error(
            generation.error.message,
          );
        }

        if (
          !generation.data
        ) {
          return json(
            {
              success: false,
              error:
                "Generation not found.",
            },
            404,
          );
        }

        if (
          generation.data.type !==
          "video"
        ) {
          return json(
            {
              success: false,
              error:
                "Generation type must be video.",
            },
            409,
          );
        }

        await updateGeneration({
          generationId,
          userId,
          status:
            "processing",
        });

        const form =
          new FormData();

        form.append(
          "model",
          "sora-2",
        );

        form.append(
          "prompt",
          prompt,
        );

        const response =
          await openAI(
            "/videos",
            {
              method:
                "POST",
              body:
                form,
            },
          );

        const data =
          await readJson(
            response,
          );

        if (
          !response.ok
        ) {
          throw new Error(
            getApiError(
              data,
              "Video generation failed.",
            ),
          );
        }

        const videoId =
          typeof data.id ===
          "string"
            ? data.id
            : "";

        if (!videoId) {
          throw new Error(
            "OpenAI did not return a video ID.",
          );
        }

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
            typeof data.status ===
            "string"
              ? data.status
              : "queued",
          progress:
            typeof data.progress ===
            "number"
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    data.progress,
                  ),
                )
              : 0,
        });
      }

      if (
        action === "status"
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

        const generation =
          await getAdminClient()
            .from(
              "generation_history",
            )
            .select(
              "id, user_id, type, metadata",
            )
            .eq(
              "id",
              generationId,
            )
            .eq(
              "user_id",
              userId,
            )
            .maybeSingle();

        if (
          generation.error
        ) {
          throw new Error(
            generation.error.message,
          );
        }

        if (
          !generation.data
        ) {
          return json(
            {
              success: false,
              error:
                "Generation not found.",
            },
            404,
          );
        }

        const metadata =
          generation.data
            .metadata;

        if (
          metadata &&
          typeof metadata ===
            "object" &&
          !Array.isArray(
            metadata,
          )
        ) {
          const storedVideoId =
            (
              metadata as Record<
                string,
                unknown
              >
            ).videoId;

          if (
            typeof storedVideoId ===
              "string" &&
            storedVideoId !==
              videoId
          ) {
            return json(
              {
                success: false,
                error:
                  "Video ID does not match the generation.",
              },
              403,
            );
          }
        }

        const response =
          await openAI(
            `/videos/${encodeURIComponent(
              videoId,
            )}`,
            {
              method:
                "GET",
            },
          );

        const data =
          await readJson(
            response,
          );

        if (
          !response.ok
        ) {
          throw new Error(
            getApiError(
              data,
              "Unable to retrieve video status.",
            ),
          );
        }

        const status =
          typeof data.status ===
          "string"
            ? data.status
            : "queued";

        const progress =
          typeof data.progress ===
          "number"
            ? Math.max(
                0,
                Math.min(
                  100,
                  data.progress,
                ),
              )
            : status ===
              "completed"
            ? 100
            : 0;

        if (
          status ===
          "completed"
        ) {
          const videoUrl =
            await storeVideo(
              videoId,
            );

          await updateGeneration({
            generationId,
            userId,
            status:
              "completed",
            provider:
              "openai",
            model:
              "sora-2",
            resultUrl:
              videoUrl,
          });

          return json({
            success: true,
            generationId,
            videoId,
            videoUrl,
            status:
              "completed",
            progress: 100,
          });
        }

        if (
          status ===
            "failed" ||
          status ===
            "cancelled"
        ) {
          const errorMessage =
            getApiError(
              data,
              `Video generation ${status}.`,
            );

          await updateGeneration({
            generationId,
            userId,
            status:
              "failed",
            provider:
              "openai",
            model:
              "sora-2",
            errorMessage,
          });

          return json(
            {
              success: false,
              generationId,
              videoId,
              status,
              progress,
              error:
                errorMessage,
            },
            200,
          );
        }

        return json({
          success: true,
          generationId,
          videoId,
          status,
          progress,
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
              "openai",
            model:
              "sora-2",
            errorMessage:
              message,
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
        "video-generate error:",
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
