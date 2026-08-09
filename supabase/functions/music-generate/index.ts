import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const ELEVENLABS_API_KEY =
  Deno.env.get(
    "ELEVENLABS_API_KEY"
  );

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SECRET_KEYS =
  Deno.env.get(
    "SUPABASE_SECRET_KEYS"
  );

const ELEVENLABS_MUSIC_URL =
  "https://api.elevenlabs.io/v1/music";

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

function getSecretKey(): string {
  if (!SUPABASE_SECRET_KEYS) {
    throw new Error(
      "SUPABASE_SECRET_KEYS is not configured."
    );
  }

  const keys =
    JSON.parse(
      SUPABASE_SECRET_KEYS
    ) as Record<string, unknown>;

  const key =
    keys.default;

  if (
    typeof key !== "string" ||
    !key.trim()
  ) {
    throw new Error(
      "Default Supabase secret key is missing."
    );
  }

  return key;
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
      if (!ELEVENLABS_API_KEY) {
        return jsonResponse(
          {
            success: false,
            error:
              "ELEVENLABS_API_KEY is not configured.",
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

      const response =
        await fetch(
          ELEVENLABS_MUSIC_URL,
          {
            method:
              "POST",
            headers: {
              "xi-api-key":
                ELEVENLABS_API_KEY,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                prompt:
                  prompt.trim(),
              }),
          }
        );

      if (!response.ok) {
        const errorText =
          await response.text();

        return jsonResponse(
          {
            success: false,
            error:
              errorText ||
              `ElevenLabs request failed with status ${response.status}.`,
          },
          response.status
        );
      }

      const audioBuffer =
        await response.arrayBuffer();

      if (
        audioBuffer.byteLength ===
        0
      ) {
        throw new Error(
          "Generated music is empty."
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
              : "Music generation failed.",
        },
        500
      );
    }
  }
);
