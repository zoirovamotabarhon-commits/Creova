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

async
