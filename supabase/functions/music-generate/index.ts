import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2";

import {
  updateGeneration,
} from "../_shared/generation.ts";

const ELEVENLABS_API_KEY =
  Deno.env.get(
    "ELEVENLABS_API_KEY",
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

  const supabase =
    getAdminClient();

  const {
    data,
    error,
  } =
    await supabase.auth.getUser(
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

function bufferToBase64(
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
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        i,
        Math.min(
          i + chunkSize,
          bytes.length,
        ),
      );

    binary +=
      String.fromCharCode(
        ...chunk,
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
      if (
        !ELEVENLABS_API_KEY
      ) {
        return json(
          {
            success: false,
            error:
              "ELEVENLABS_API_KEY is not configured.",
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

      userId =
        user.id;

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

      const prompt =
        typeof body.prompt ===
        "string"
          ? body.prompt.trim()
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

      if (!prompt) {
        return json(
          {
            success: false,
            error:
              "Music prompt is required.",
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

      const response =
        await fetch(
          "https://api.elevenlabs.io/v1/music",
          {
            method:
              "POST",
            headers: {
              "xi-api-key":
                ELEVENLABS_API_KEY,
              "Content-Type":
                "application/json",
              Accept:
                "audio/mpeg",
            },
            body: JSON.stringify({
              prompt,
            }),
          },
        );

      if (!response.ok) {
        const errorText =
          await response.text();

        throw new Error(
          errorText ||
            `ElevenLabs request failed: ${response.status}`,
        );
      }

      const audioBuffer =
        await response.arrayBuffer();

      if (
        audioBuffer.byteLength ===
        0
      ) {
        throw new Error(
          "Generated music is empty.",
        );
      }

      const base64 =
        bufferToBase64(
          audioBuffer,
        );

      const audioUrl =
        `data:audio/mpeg;base64,${base64}`;

      await updateGeneration({
        generationId,
        userId,
        status:
          "completed",
        provider:
          "elevenlabs",
        model:
          "music_v1",
        resultUrl:
          audioUrl,
      });

      return json({
        success: true,
        generationId,
        audioUrl,
        status:
          "completed",
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
                : "Music generation failed.",
          });
        } catch (
          updateError
        ) {
          console.error(
            "Failed to update generation:",
            updateError,
          );
        }
      }

      console.error(
        "music-generate error:",
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
              : "Music generation failed.",
        },
        500,
      );
    }
  },
);
