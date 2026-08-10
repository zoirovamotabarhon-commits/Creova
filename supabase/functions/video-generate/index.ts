import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY");

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SECRET_KEYS =
  Deno.env.get("SUPABASE_SECRET_KEYS");

const OPENAI_BASE_URL =
  "https://api.openai.com/v1";

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

function jsonResponse(
  body: JsonObject,
  status = 200
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers:
        CORS_HEADERS,
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
    const keys =
      JSON.parse(
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

    return defaultKey.trim();
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
    !authorization.startsWith(
      "Bearer "
    )
  ) {
    throw new Error(
      "Authentication required."
    );
  }

  const token =
    authorization
      .slice("Bearer ".length)
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
): Promise<Response> {
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
): Promise<JsonObject> {
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

function getErrorMessage(
  data: JsonObject,
  fallback: string
): string {
  const errorObject =
    data.error;

  if (
    typeof errorObject ===
      "object" &&
    errorObject !== null &&
    "message" in
      errorObject
  ) {
    const message =
      (
        errorObject as {
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
    error:
      createError,
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
): Promise<string> {
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

    throw new Error(
      getErrorMessage(
        errorData,
        `MP4 download failed with status ${response.status}.`
      )
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
    error:
      uploadError,
  } =
    await supabase.storage
      .from(
        VIDEO_BUCKET
      )
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
      .from(
        VIDEO_BUCKET
      )
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
          status: 200,
          headers:
            CORS_HEADERS,
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
              body:
                form,
            }
          );

        const data =
          await readOpenAIJson(
            response
          );

        if (
          !response.ok
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                getErrorMessage(
                  data,
                  "Video generation failed."
                ),
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
          return jsonResponse(
            {
              success: false,
              videoId:
                id,
              error:
                getErrorMessage(
                  data,
                  "Unable to retrieve video status."
                ),
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
          return jsonResponse({
            success: false,
            videoId:
              data.id ?? id,
            status,
            progress,
            error:
              getErrorMessage(
                data,
                `Video status: ${status}`
              ),
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
            progress:
              100,
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
      console.error(
        "video-generate error:",
        error
      );

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
