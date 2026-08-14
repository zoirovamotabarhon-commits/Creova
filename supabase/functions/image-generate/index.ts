import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2";

import OpenAI from "npm:openai@6";

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
              "Image prompt is required.",
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

      const result =
        await openai.images.generate(
          {
            model:
              "gpt-image-1",
            prompt,
            size:
              "1024x1024",
          },
        );

      const image =
        result.data?.[0];

      if (!image) {
        throw new Error(
          "OpenAI returned no image.",
        );
      }

      const imageBase64 =
        image.b64_json;

      if (!imageBase64) {
        throw new Error(
          "OpenAI did not return image data.",
        );
      }

      const resultUrl =
        `data:image/png;base64,${imageBase64}`;

      await updateGeneration({
        generationId,
        userId,
        status:
          "completed",
        provider:
          "openai",
        model:
          "gpt-image-1",
        resultUrl,
      });

      return json({
        success: true,
        generationId,
        imageUrl:
          resultUrl,
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
                : "Image generation failed.",
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
        "image-generate error:",
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
              : "Image generation failed.",
        },
        500,
      );
    }
  },
);
