import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@6.49.0";
import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY");

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  ) ??
  Deno.env.get(
    "SUPABASE_SECRET_KEY"
  );

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
  "Content-Type":
    "application/json",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: CORS_HEADERS,
    }
  );
}

function getServiceRoleKey(): string {
  if (
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured."
    );
  }

  return SUPABASE_SERVICE_ROLE_KEY;
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
      .replace(
        "Bearer ",
        ""
      )
      .trim();

  if (!SUPABASE_URL) {
    throw new Error(
      "SUPABASE_URL is not configured."
    );
  }

  const supabase =
    createClient(
      SUPABASE_URL,
      getServiceRoleKey(),
      {
        auth: {
          autoRefreshToken:
            false,
          persistSession:
            false,
        },
      }
    );

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

function arrayBufferToBase64(
  buffer: ArrayBuffer
): string {
  const bytes =
    new Uint8Array(buffer);

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary +=
      String.fromCharCode(
        ...bytes.subarray(
          i,
          Math.min(
            i + chunkSize,
            bytes.length
          )
        )
      );
  }

  return btoa(binary);
}

const openai =
  new OpenAI({
    apiKey:
      OPENAI_API_KEY,
  });

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

      await requireUser(req);

      const body =
        (await req.json()) as Record<
          string,
          unknown
        >;

      const text =
        body.text;

      if (
        typeof text !==
          "string" ||
        !text.trim()
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Text is required.",
          },
          400
        );
      }

      const speech =
        await openai.audio.speech.create(
          {
            model:
              "gpt-4o-mini-tts",
            voice:
              "alloy",
            input:
              text.trim(),
            response_format:
              "mp3",
          }
        );

      const audioBuffer =
        await speech.arrayBuffer();

      if (
        audioBuffer.byteLength ===
        0
      ) {
        throw new Error(
          "Audio generation returned empty data."
        );
      }

      const audioBase64 =
        arrayBufferToBase64(
          audioBuffer
        );

      return jsonResponse({
        success: true,
        audioUrl:
          `data:audio/mpeg;base64,${audioBase64}`,
      });
    } catch (error) {
      return jsonResponse(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Voice generation failed.",
        },
        500
      );
    }
  }
);
