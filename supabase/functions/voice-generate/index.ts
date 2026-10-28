import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.57.0";

import {
  getGenerationForUser,
  storeAssetAndGetSignedUrl,
  updateGeneration,
} from "../_shared/generation.ts";

const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ?? "";

// gemini-3.8-flash-tts supports 130+ languages (flash-lite: 100+, it lacks Thai, Swedish,
// Finnish, Slovenian, Lithuanian, Tajik and Swahili), so the full model is the default.
const GEMINI_TTS_MODEL =
  Deno.env.get("GEMINI_TTS_MODEL") ??
  "gemini-3.8-flash-tts";

// Female assistant voice ("Sulafat" is Warm). To get a custom persona (for example a warm,
// friendly young woman) create it in Google AI Studio -> Voice design and put its
// voice_... id into the GEMINI_TTS_VOICE secret.
const GEMINI_TTS_VOICE =
  Deno.env.get("GEMINI_TTS_VOICE") ?? "Sulafat";

// Turn-level delivery. Do not put age or gender here: those come from the voice itself.
const GEMINI_TTS_STYLE =
  Deno.env.get("GEMINI_TTS_STYLE") ?? "warm, friendly and calm";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const BUCKET =
  "generation-assets";

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

function admin() {
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

async function getUser(
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

  const {
    data,
    error,
  } =
    await admin().auth.getUser(
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

async function ensureBucket() {
  const client =
    admin();

  const {
    data,
    error,
  } =
    await client.storage.listBuckets();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  if (
    data?.some(
      (bucket) =>
        bucket.name ===
        BUCKET,
    )
  ) {
    return;
  }

  const {
    error:
      createError,
  } =
    await client.storage.createBucket(
      BUCKET,
      {
        public: false,
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


function extractAudioBase64(
  data: unknown,
): string | null {
  if (
    !data ||
    typeof data !==
      "object"
  ) {
    return null;
  }

  const candidates =
    (
      data as {
        candidates?: unknown;
      }
    ).candidates;

  if (
    !Array.isArray(
      candidates,
    )
  ) {
    return null;
  }

  for (
    const candidate of candidates
  ) {
    if (
      !candidate ||
      typeof candidate !==
        "object"
    ) {
      continue;
    }

    const content =
      (
        candidate as {
          content?: unknown;
        }
      ).content;

    if (
      !content ||
      typeof content !==
        "object"
    ) {
      continue;
    }

    const parts =
      (
        content as {
          parts?: unknown;
        }
      ).parts;

    if (
      !Array.isArray(parts)
    ) {
      continue;
    }

    for (
      const part of parts
    ) {
      if (
        !part ||
        typeof part !==
          "object"
      ) {
        continue;
      }

      const inlineData =
        (
          part as {
            inlineData?: unknown;
          }
        ).inlineData;

      if (
        !inlineData ||
        typeof inlineData !==
          "object"
      ) {
        continue;
      }

      const mimeType =
        (
          inlineData as {
            mimeType?: unknown;
          }
        ).mimeType;

      const base64 =
        (
          inlineData as {
            data?: unknown;
          }
        ).data;

      if (
        typeof base64 ===
          "string" &&
        base64.length > 0
      ) {
        return base64;
      }
    }
  }

  return null;
}

async function generateSpeech(
  text: string,
) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured.",
    );
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      GEMINI_TTS_MODEL,
    )}:generateContent`;

  const apiResponse =
    await fetch(
      endpoint,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            GEMINI_API_KEY,
        },

        body: JSON.stringify({
          contents: [
            {
              role:
                "user",

              parts: [
                {
                  text,
                  // speech_metadata exists only in the Gemini 3.8 TTS API
                  ...(GEMINI_TTS_MODEL.startsWith("gemini-3.8") && GEMINI_TTS_STYLE
                    ? { speech_metadata: { style: GEMINI_TTS_STYLE } }
                    : {}),
                },
              ],
            },
          ],

          generationConfig: {
            responseModalities: [
              "AUDIO",
            ],

            speechConfig: {
              voiceConfig: {
                voice:
                  GEMINI_TTS_VOICE,
              },
            },
          },
        }),
      },
    );

  const raw =
    await apiResponse.text();

  let data:
    Record<string, unknown> = {};

  try {
    data = raw
      ? JSON.parse(raw)
      : {};
  } catch {
    data = {
      raw,
    };
  }

  if (
    !apiResponse.ok
  ) {
    const errorObject =
      data.error;

    const message =
      errorObject &&
      typeof errorObject ===
        "object"
        ? (
            errorObject as {
              message?: unknown;
            }
          ).message
        : undefined;

    throw new Error(
      typeof message ===
        "string"
        ? message
        : `Gemini TTS failed (${apiResponse.status}).`,
    );
  }

  const base64 =
    extractAudioBase64(
      data,
    );

  if (!base64) {
    throw new Error(
      "Gemini TTS did not return audio data.",
    );
  }

  return Uint8Array.from(
    atob(base64),
    (character) =>
      character.charCodeAt(0),
  );
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
        },
      );
    }

    if (
      req.method !==
      "POST"
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

    let generationId =
      "";

    let userId =
      "";

    try {
      const currentUser =
        await getUser(
          req,
        );

      if (!currentUser) {
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
        currentUser.id;

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

      if (
        text.length >
        32000
      ) {
        return json(
          {
            success: false,
            error:
              "Voice text is too long.",
          },
          400,
        );
      }

      await getGenerationForUser(
        generationId,
        userId,
        "voice",
      );

      await updateGeneration({
        generationId,
        userId,
        expectedType:
          "voice",
        status:
          "processing",
      });

      // NOTE: gemini-3.8-flash-lite-tts already returns a full
      // WAV file (RIFF header included) for unary requests -
      // earlier Gemini TTS models (e.g. gemini-3.1-flash-tts-preview)
      // returned headerless raw PCM, which is why the previous
      // version wrapped the bytes in a WAV header via pcmToWav().
      // Doing that here would wrap a second WAV header around an
      // already-complete WAV file, corrupting the audio. The bytes
      // from generateSpeech() are stored as-is.
      const wav =
        await generateSpeech(
          text,
        );

      await ensureBucket();

      const stored =
        await storeAssetAndGetSignedUrl({
          bucket:
            BUCKET,

          path:
            `${userId}/${generationId}.wav`,

          data:
            wav,

          contentType:
            "audio/wav",

          expiresIn:
            60 * 60,
        });

      await updateGeneration({
        generationId,
        userId,
        expectedType:
          "voice",
        status:
          "completed",
        provider:
          "gemini",
        model:
          GEMINI_TTS_MODEL,
        resultUrl:
          stored.url,
        metadata: {
          storageBucket:
            BUCKET,

          storagePath:
            stored.path,

          provider:
            "gemini",
        },
      });

      return json({
        success: true,

        generationId,

        audioUrl:
          stored.url,

        model:
          GEMINI_TTS_MODEL,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Voice generation failed.";

      if (
        generationId &&
        userId
      ) {
        try {
          await updateGeneration({
            generationId,
            userId,
            expectedType:
              "voice",
            status:
              "failed",
            errorMessage:
              message,
          });
        } catch (
          updateError
        ) {
          console.error(
            "Failed to mark voice generation as failed:",
            updateError,
          );
        }
      }

      console.error(
        "voice-generate Gemini error:",
        error,
      );

      return json(
        {
          success: false,

          generationId:
            generationId ||
            undefined,

          error:
            message,
        },
        500,
      );
    }
  },
);
