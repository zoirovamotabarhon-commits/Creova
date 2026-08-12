import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@6.49.0";
import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY =
  Deno.env.get(
    "OPENAI_API_KEY"
  ) ?? "";

const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL"
  ) ?? "";

const SUPABASE_SECRET_KEYS =
  Deno.env.get(
    "SUPABASE_SECRET_KEYS"
  );

const SUPABASE_SECRET_KEY =
  Deno.env.get(
    "SUPABASE_SECRET_KEY"
  );

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  );

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":
    "*",
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
      headers:
        CORS_HEADERS,
    }
  );
}

function getSecretKey(): string {
  if (
    SUPABASE_SECRET_KEYS
  ) {
    try {
      const parsed =
        JSON.parse(
          SUPABASE_SECRET_KEYS
        ) as Record<
          string,
          unknown
        >;

      const defaultKey =
        parsed.default;

      if (
        typeof defaultKey ===
          "string" &&
        defaultKey.trim()
      ) {
        return defaultKey.trim();
      }
    } catch {
      // Fall through.
    }
  }

  if (
    SUPABASE_SECRET_KEY?.trim()
  ) {
    return SUPABASE_SECRET_KEY.trim();
  }

  if (
    SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return SUPABASE_SERVICE_ROLE_KEY.trim();
  }

  throw new Error(
    "Supabase secret key is not configured."
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
    !authorization?.startsWith(
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
    createClient(
      SUPABASE_URL,
      getSecretKey(),
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
      req.method === "OPTIONS"
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
      req.method !== "POST"
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

      let body:
        Record<string, unknown>;

      try {
        body =
          (await req.json()) as Record<
            string,
            unknown
          >;
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

      const text =
        typeof body.text ===
        "string"
          ? body.text.trim()
          : "";

      if (!text) {
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
            model: "tts-1",
            voice: "alloy",
            input: text,
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
      console.error(
        "voice-generate error:",
        error
      );

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
