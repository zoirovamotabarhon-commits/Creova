import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import OpenAI from "npm:openai@6.49.0";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json",
};

function json(
  body: Record<string, unknown>,
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

function arrayBufferToBase64(
  buffer: ArrayBuffer,
): string {
  const bytes =
    new Uint8Array(
      buffer,
    );

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let index = 0;
    index < bytes.length;
    index += chunkSize
  ) {
    binary +=
      String.fromCharCode(
        ...bytes.subarray(
          index,
          Math.min(
            index + chunkSize,
            bytes.length,
          ),
        ),
      );
  }

  return btoa(binary);
}

Deno.serve(
  async (req) => {
    if (
      req.method === "OPTIONS"
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

    let generationId = "";
    let userId = "";

    try {
      if (!OPENAI_API_KEY) {
        return json(
          {
            success: false,
            error:
              "OPENAI_API_KEY is not configured.",
          },
          500,
        );
      }

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

      userId = user.id;

      const body =
        (await req.json()) as Record<
          string,
          unknown
        >;

      generationId =
        typeof body.generationId ===
        "string"
          ? body.generationId.trim()
          : "";

      const text =
        typeof body.text ===
        "string"
          ? body.text.trim()
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

      if (!text) {
        return json(
          {
            success: false,
            error:
              "Text is required.",
          },
          400,
        );
      }

      await updateGeneration({
        generationId,
        userId,
        status:
          "processing",
      });

      const openai =
        new OpenAI({
          apiKey:
            OPENAI_API_KEY,
        });

      const speech =
        await openai.audio.speech.create(
          {
            model:
              "tts-1",
            voice:
              "alloy",
            input:
              text,
            response_format:
              "mp3",
          },
        );

      const audioBuffer =
        await speech.arrayBuffer();

      if (
        audioBuffer.byteLength ===
        0
      ) {
        throw new Error(
          "Audio generation returned empty data.",
        );
      }

      const audioUrl =
        `data:audio/mpeg;base64,${arrayBufferToBase64(
          audioBuffer,
        )}`;

      await updateGeneration({
        generationId,
        userId,
        status:
          "completed",
        provider:
          "openai",
        model:
          "tts-1",
        resultUrl:
          audioUrl,
      });

      return json({
        success: true,
        generationId,
        audioUrl,
      });
    } catch (error) {
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
            errorMessage:
              error instanceof Error
                ? error.message
                : "Voice generation failed.",
          });
        } catch (
          updateError
        ) {
          console.error(
            "Voice generation status update failed:",
            updateError,
          );
        }
      }

      console.error(
        "voice-generate error:",
        error,
      );

      return json(
        {
          success: false,
          generationId:
            generationId ||
            undefined,
          error:
            error instanceof Error
              ? error.message
              : "Voice generation failed.",
        },
        500,
      );
    }
  },
);
