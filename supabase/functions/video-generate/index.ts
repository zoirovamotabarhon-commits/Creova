import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY");

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

function getSupabaseAdmin() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase server configuration is missing."
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
    }
  );
}

async function openAIRequest(
  path: string,
  options: RequestInit = {}
) {
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

  const { data: buckets, error } =
    await supabaseAdmin.storage.listBuckets();

  if (error) {
    throw new Error(
      `Unable to check Storage buckets: ${error.message}`
    );
  }

  const exists = buckets.some(
    (bucket) =>
      bucket.name === VIDEO_BUCKET
  );

  if (exists) {
    return;
  }

  const { error: createError } =
    await supabaseAdmin.storage.createBucket(
      VIDEO_BUCKET,
      {
        public: false,
        fileSizeLimit:
          "500MB",
        allowedMimeTypes: [
          "video/mp4",
        ],
      }
    );

  if (
    createError &&
    !createError.message
      .toLowerCase()
      .includes("already exists")
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

  const contentResponse =
    await openAIRequest(
      `/videos/${encodeURIComponent(
        videoId
      )}/content?variant=video`,
      {
        method: "GET",
        headers: {
          Accept: "video/mp4",
        },
      }
    );

  if (!contentResponse.ok) {
    const errorText =
      await contentResponse.text();

    throw new Error(
      errorText ||
        "Unable to download generated MP4."
    );
  }

  const videoBuffer =
    await contentResponse.arrayBuffer();

  if (!videoBuffer.byteLength) {
    throw new Error(
      "Generated MP4 is empty."
    );
  }

  const supabaseAdmin =
    getSupabaseAdmin();

  const filePath =
    `${videoId}.mp4`;

  const { error: uploadError } =
    await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .upload(
        filePath,
        videoBuffer,
        {
          contentType:
            "video/mp4",
          upsert: true,
        }
      );

  if (uploadError) {
    throw new Error(
      `Unable to save MP4: ${uploadError.message}`
    );
  }

  const { data, error } =
    await supabaseAdmin.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(
        filePath,
        60 * 60
      );

  if (error || !data?.signedUrl) {
    throw new Error(
      `Unable to create video URL: ${
        error?.message ??
        "Signed URL unavailable."
      }`
    );
  }

  return data.signedUrl;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error:
            "Method not allowed.",
        },
        405
      );
    }

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
      !SUPABASE_SERVICE_ROLE_KEY
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
      typeof body?.action === "string"
        ? body.action
        : "create";

    /*
     * CREATE
     */
    if (action === "create") {
      const prompt = body?.prompt;

      if (
        typeof prompt !== "string" ||
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

      const response =
        await openAIRequest(
          "/videos",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              model: "sora-2",
              prompt:
                prompt.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            success: false,
            error:
              data?.error?.message ??
              "Video generation failed.",
          },
          response.status
        );
      }

      return jsonResponse({
        success: true,
        videoId: data.id,
        status:
          data.status ?? "queued",
        progress:
          typeof data.progress ===
          "number"
            ? data.progress
            : 0,
      });
    }

    /*
     * STATUS
     */
    if (action === "status") {
      const videoId =
        body?.videoId;

      if (
        typeof videoId !== "string" ||
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

      const cleanVideoId =
        videoId.trim();

      const response =
        await openAIRequest(
          `/videos/${encodeURIComponent(
            cleanVideoId
          )}`,
          {
            method: "GET",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            success: false,
            error:
              data?.error?.message ??
              "Unable to retrieve video status.",
          },
          response.status
        );
      }

      const status =
        data.status ?? "unknown";

      if (
        status === "failed" ||
        status === "cancelled"
      ) {
        return jsonResponse({
          success: false,
          videoId:
            data.id ??
            cleanVideoId,
          status,
          progress:
            typeof data.progress ===
            "number"
              ? data.progress
              : 0,
          error:
            data?.error?.message ??
            `Video status: ${status}`,
        });
      }

      /*
       * COMPLETED → MP4 → STORAGE
       */
      if (
        status === "completed"
      ) {
        try {
          const videoUrl =
            await downloadAndStoreVideo(
              cleanVideoId
            );

          return jsonResponse({
            success: true,
            videoId:
              cleanVideoId,
            status:
              "completed",
            progress: 100,
            videoUrl,
          });
        } catch (error) {
          return jsonResponse(
            {
              success: false,
              videoId:
                cleanVideoId,
              status:
                "completed",
              progress: 100,
              error:
                error instanceof Error
                  ? error.message
                  : "Video completed but MP4 storage failed.",
            },
            500
          );
        }
      }

      return jsonResponse({
        success: true,
        videoId:
          data.id ??
          cleanVideoId,
        status,
        progress:
          typeof data.progress ===
          "number"
            ? data.progress
            : 0,
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
});
