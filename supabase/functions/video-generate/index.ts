import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

import {
  corsHeaders,
} from "npm:@supabase/supabase-js@2/cors";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY");

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SECRET_KEYS =
  Deno.env.get("SUPABASE_SECRET_KEYS");

const OPENAI_BASE_URL =
  "https://api.openai.com/v1";

const VIDEO_BUCKET = "videos";

type JsonObject =
  Record<string, unknown>;

function jsonResponse(
  body: JsonObject,
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

function getDefaultSecretKey(): string {
  if (!SUPABASE_SECRET_KEYS) {
    throw new Error(
      "SUPABASE_SECRET_KEYS is not configured."
    );
  }

  try {
    const keys = JSON.parse(
      SUPABASE_SECRET_KEYS
    ) as Record<string, unknown>;

    const defaultKey =
      keys.default;

    if (
      typeof defaultKey !==
        "string" ||
      !defaultKey.trim()
    ) {
      throw new Error(
        "Default Supabase secret key is missing."
      );
    }

    return defaultKey;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Invalid SUPABASE_SECRET_KEYS."
    );
  }
}

function getAdminClient() {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }

  return createClient(
    SUPABASE_URL,
    getDefaultSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

async function requireUser(
  req: Request
) {
  const authorization =
    req.headers.get(
      "Authorization"
    );

  if (
    !authorization ||
    !authorization
      .startsWith("Bearer ")
  ) {
    throw new Error(
      "Authentication required."
    );
  }

  const token =
    authorization
      .replace(
        "Bearer ",
        ""
      )
      .trim();

  if (!token) {
    throw new Error(
      "Authentication token is missing."
    );
  }

  const supabase =
    getAdminClient();

  const {
    data,
    error,
  } =
    await supabase.auth.getUser(
      token
    );

  if (
    error ||
    !data.user
  ) {
    throw new Error(
      "Invalid or expired authentication token."
    );
  }

  return data.user;
}

async function openAIRequest(
  path: string,
  options: RequestInit = {}
) {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured."
    );
  }

  const headers =
    new Headers(
      options.headers
    );

  headers.set(
    "Authorization",
    `Bearer ${OPENAI_API_KEY}`
  );

  return fetch(
    `${OPENAI_BASE_URL}${path}`,
    {
      ...options,
      headers,
    }
  );
}

async function readOpenAIJson(
  response: Response
) {
  const text =
    await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text
    ) as JsonObject;
  } catch {
    return {
      raw: text,
    };
  }
}

async function ensureVideoBucket() {
  const supabase =
    getAdminClient();

  const {
    data,
    error,
  } =
    await supabase.storage
      .listBuckets();

  if (error) {
    throw new Error(
      `Unable to check Storage buckets: ${error.message}`
    );
  }

  const exists =
    data?.some(
      (bucket) =>
        bucket.name ===
        VIDEO_BUCKET
    ) ?? false;

  if (exists) {
    return;
  }

  const {
    error: createError,
  } =
    await supabase.storage
      .createBucket(
        VIDEO_BUCKET,
        {
          public: false,
          allowedMimeTypes: [
            "video/mp4",
          ],
        }
      );

  if (
    createError &&
    !createError.message
      .toLowerCase()
      .includes(
        "already exists"
      )
  ) {
    throw new Error(
      `Unable to create video bucket: ${createError.message}`
    );
  }
}

async function downloadAndStoreVideo(
  videoId: string
) {
  await ensureVideoBucket();

  const response =
    await openAIRequest(
      `/videos/${encodeURIComponent(
        videoId
      )}/content?variant=video`,
      {
        method: "GET",
        headers: {
          Accept:
            "video/mp4",
        },
      }
    );

  if (!response.ok) {
    const errorData =
      await readOpenAIJson(
        response
      );

    const message =
      typeof errorData?.error ===
        "object" &&
      errorData.error !== null &&
      "message" in
        errorData.error
        ? String(
            (
              errorData.error as {
                message?: unknown;
              }
            ).message ??
              "Unable to download video."
          )
        : typeof errorData.raw ===
          "string"
        ? errorData.raw
        : `MP4 download failed with status ${response.status}.`;

    throw new Error(
      message
    );
  }

  const videoBuffer =
    await response.arrayBuffer();

  if (
    videoBuffer.byteLength ===
    0
  ) {
    throw new Error(
      "Generated MP4 is empty."
    );
  }

  const supabase =
    getAdminClient();

  const storagePath =
    `${videoId}.mp4`;

  const {
    error: uploadError,
  } =
    await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(
        storagePath,
        videoBuffer,
        {
          contentType:
            "video/mp4",
          upsert: true,
        }
      );

  if (uploadError) {
    throw new Error(
      `MP4 upload failed: ${uploadError.message}`
    );
  }

  const {
    data,
    error:
      signedUrlError,
  } =
    await supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(
        storagePath,
        3600
      );

  if (
    signedUrlError ||
    !data?.signedUrl
  ) {
    throw new Error(
      signedUrlError?.message ??
        "Unable to create signed MP4 URL."
    );
  }

  return data.signedUrl;
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
      if (!OPENAI_API_KEY) {
        return jsonResponse(
          {
            success: false,
            error:
              "OPENAI_API_KEY is not configured.",
          },
          500
        );
      }

      if (
        !SUPABASE_URL ||
        !SUPABASE_SECRET_KEYS
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Supabase server configuration is missing.",
          },
          500
        );
      }

      await requireUser(
        req
      );

      let body: JsonObject;

      try {
        body =
          (await req.json()) as JsonObject;
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

      const action =
        typeof body.action ===
        "string"
          ? body.action
          : "";

      /*
       * CREATE VIDEO
       */
      if (
        action ===
        "create"
      ) {
        const prompt =
          body.prompt;

        if (
          typeof prompt !==
            "string" ||
          !prompt.trim()
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "Prompt is required.",
            },
            400
          );
        }

        const form =
          new FormData();

        form.append(
          "model",
          "sora-2"
        );

        form.append(
          "prompt",
          prompt.trim()
        );

        const response =
          await openAIRequest(
            "/videos",
            {
              method:
                "POST",
              body: form,
            }
          );

        const data =
          await readOpenAIJson(
            response
          );

        if (
          !response.ok
        ) {
          const errorObject =
            data.error;

          const message =
            typeof errorObject ===
              "object" &&
            errorObject !==
              null &&
            "message" in
              errorObject
              ? String(
                  (
                    errorObject as {
                      message?: unknown;
                    }
                  ).message ??
                    "Video generation failed."
                )
              : typeof data.raw ===
                "string"
              ? data.raw
              : "Video generation failed.";

          return jsonResponse(
            {
              success: false,
              error: message,
            },
            response.status
          );
        }

        if (
          typeof data.id !==
          "string"
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "OpenAI did not return a video ID.",
            },
            502
          );
        }

        return jsonResponse({
          success: true,
          videoId:
            data.id,
          status:
            typeof data.status ===
            "string"
              ? data.status
              : "queued",
          progress:
            typeof data.progress ===
            "number"
              ? data.progress
              : 0,
        });
      }

      /*
       * CHECK VIDEO STATUS
       */
      if (
        action ===
        "status"
      ) {
        const videoId =
          body.videoId;

        if (
          typeof videoId !==
            "string" ||
          !videoId.trim()
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "Video ID is required.",
            },
            400
          );
        }

        const id =
          videoId.trim();

        const response =
          await openAIRequest(
            `/videos/${encodeURIComponent(
              id
            )}`,
            {
              method:
                "GET",
            }
          );

        const data =
          await readOpenAIJson(
            response
          );

        if (
          !response.ok
        ) {
          const errorObject =
            data.error;

          const message =
            typeof errorObject ===
              "object" &&
            errorObject !==
              null &&
            "message" in
              errorObject
              ? String(
                  (
                    errorObject as {
                      message?: unknown;
                    }
                  ).message ??
                    "Unable to retrieve video status."
                )
              : typeof data.raw ===
                "string"
              ? data.raw
              : "Unable to retrieve video status.";

          return jsonResponse(
            {
              success: false,
              videoId: id,
              error: message,
            },
            response.status
          );
        }

        const status =
          typeof data.status ===
          "string"
            ? data.status
            : "unknown";

        const progress =
          typeof data.progress ===
          "number"
            ? Math.max(
                0,
                Math.min(
                  100,
                  data.progress
                )
              )
            : status ===
              "completed"
            ? 100
            : 0;

        if (
          status ===
            "failed" ||
          status ===
            "cancelled"
        ) {
          const errorObject =
            data.error;

          const errorMessage =
            typeof errorObject ===
              "object" &&
            errorObject !==
              null &&
            "message" in
              errorObject
              ? String(
                  (
                    errorObject as {
                      message?: unknown;
                    }
                  ).message ??
                    `Video status: ${status}`
                )
              : `Video status: ${status}`;

          return jsonResponse({
            success: false,
            videoId:
              data.id ?? id,
            status,
            progress,
            error:
              errorMessage,
          });
        }

        if (
          status ===
          "completed"
        ) {
          const videoUrl =
            await downloadAndStoreVideo(
              id
            );

          return jsonResponse({
            success: true,
            videoId:
              data.id ?? id,
            status:
              "completed",
            progress: 100,
            videoUrl,
          });
        }

        return jsonResponse({
          success: true,
          videoId:
            data.id ?? id,
          status,
          progress,
        });
      }

      return jsonResponse(
        {
          success: false,
          error:
            "Unknown action. Use 'create' or 'status'.",
        },
        400
      );
    } catch (error) {
      return jsonResponse(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Video operation failed.",
        },
        500
      );
    }
  }
);
