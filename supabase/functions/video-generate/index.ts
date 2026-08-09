import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY =
  Deno.env.get(
    "OPENAI_API_KEY"
  );

const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL"
  );

const SUPABASE_SECRET_KEYS =
  Deno.env.get(
    "SUPABASE_SECRET_KEYS"
  );

const OPENAI_BASE_URL =
  "https://api.openai.com/v1";

const VIDEO_BUCKET = "videos";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
}

function getSecretKey() {
  if (!SUPABASE_SECRET_KEYS) {
    throw new Error(
      "SUPABASE_SECRET_KEYS is not configured."
    );
  }

  try {
    const parsed =
      JSON.parse(
        SUPABASE_SECRET_KEYS
      );

    const key =
      parsed?.default;

    if (
      typeof key !== "string" ||
      !key.trim()
    ) {
      throw new Error(
        "Default Supabase secret key is missing."
      );
    }

    return key;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Invalid SUPABASE_SECRET_KEYS."
    );
  }
}

function getSupabaseAdmin() {
  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }

  return createClient(
    SUPABASE_URL,
    getSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
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

  return fetch(
    `${OPENAI_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        Authorization:
          `Bearer ${OPENAI_API_KEY}`,
        ...(options.headers ?? {}),
      },
    }
  );
}

async function ensureVideoBucket() {
  const supabaseAdmin =
    getSupabaseAdmin();

  const {
    data,
    error,
  } =
    await supabaseAdmin.storage
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
    await supabaseAdmin.storage
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
      createError.message
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
    const text =
      await response.text();

    throw new Error(
      text ||
        `MP4 download failed with status ${response.status}.`
    );
  }

  const buffer =
    await response.arrayBuffer();

  if (!buffer.byteLength) {
    throw new Error(
      "Generated MP4 is empty."
    );
  }

  const supabaseAdmin =
    getSupabaseAdmin();

  const path =
    `${videoId}.mp4`;

  const {
    error: uploadError,
  } =
    await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(
        path,
        buffer,
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
    error,
  } =
    await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(
        path,
        3600
      );

  if (
    error ||
    !data?.signedUrl
  ) {
    throw new Error(
      error?.message ??
        "Unable to create signed MP4 URL."
    );
  }

  return data.signedUrl;
}

Deno.serve(
  async (req) => {
    try {
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

      if (
        !OPENAI_API_KEY
      ) {
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

      const body =
        await req.json();

      const action =
        typeof body?.action ===
        "string"
          ? body.action
          : "";

      if (
        action ===
        "create"
      ) {
        const prompt =
          body?.prompt;

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
          await response.json();

        if (
          !response.ok
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                data?.error
                  ?.message ??
                "Video generation failed.",
            },
            response.status
          );
        }

        return jsonResponse({
          success: true,
          videoId:
            data.id,
          status:
            data.status ??
            "queued",
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
          body?.videoId;

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
          await response.json();

        if (
          !response.ok
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                data?.error
                  ?.message ??
                "Unable to retrieve video status.",
            },
            response.status
          );
        }

        const status =
          data.status ??
          "unknown";

        const progress =
          typeof data.progress ===
          "number"
            ? data.progress
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
              data?.error
                ?.message ??
              `Video status: ${status}`,
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
              id,
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
            "Unknown action.",
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
