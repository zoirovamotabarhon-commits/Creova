import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { updateGeneration } from "../_shared/generation.ts";

import OpenAI from "npm:openai@6.49.0";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const OPENAI_API_KEY =
  Deno.env.get(
    "OPENAI_API_KEY",
  ) ?? "";

const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL",
  ) ?? "";

const SUPABASE_SECRET_KEYS =
  Deno.env.get(
    "SUPABASE_SECRET_KEYS",
  );

const SUPABASE_SECRET_KEY =
  Deno.env.get(
    "SUPABASE_SECRET_KEY",
  );

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
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

function getSecretKey(): string {
  if (
    SUPABASE_SECRET_KEYS
  ) {
    try {
      const parsed =
        JSON.parse(
          SUPABASE_SECRET_KEYS,
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
      // Continue with fallback keys.
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
    "Supabase secret key is not configured.",
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
    throw new Error(
      "Authentication required.",
    );
  }

  const token =
    authorization
      .slice("Bearer ".length)
      .trim();

  if (!token) {
    throw new Error(
      "Authentication token is missing.",
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
      },
    );

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
    throw new Error(
      "Invalid or expired authentication token.",
    );
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
    let user:
      | Awaited<
          ReturnType<
            typeof requireUser
          >
        >
      | null = null;

    let generationId = "";

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
      return jsonResponse(
        {
          success: false,
          error:
            "Method not allowed.",
        },
        405,
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
          500,
        );
      }

      user =
        await requireUser(
          req,
        );

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
          400,
        );
      }

      const prompt =
        typeof body.prompt ===
        "string"
          ? body.prompt.trim()
          : "";

      generationId =
        typeof body.generationId ===
        "string"
          ? body.generationId.trim()
          : "";

      if (!generationId) {
        return jsonResponse(
          {
            success: false,
            error:
              "Generation ID is required.",
          },
          400,
        );
      }

      if (!prompt) {
        return jsonResponse(
          {
            success: false,
            error:
              "Prompt is required.",
          },
          400,
        );
      }

      if (
        prompt.length > 12000
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Prompt is too long.",
          },
          400,
        );
      }

      await updateGeneration({
        generationId,
        userId:
          user.id,
        status:
          "processing",
      });

      const response =
        await openai.images.generate(
          {
            model:
              "gpt-image-2",
            prompt,
            size:
              "1024x1024",
          },
        );

      const image =
        response.data?.[0];

      if (!image) {
        throw new Error(
          "Image generation returned no image.",
        );
      }

      const imageBase64 =
        image.b64_json?.trim() ??
        "";

      const imageUrl =
        "url" in image &&
        typeof image.url ===
          "string"
          ? image.url.trim()
          : "";

      if (
        !imageBase64 &&
        !imageUrl
      ) {
        throw new Error(
          "Image data was not returned.",
        );
      }

      await updateGeneration({
        generationId,
        userId:
          user.id,
        status:
          "completed",
        provider:
          "openai",
        model:
          "gpt-image-2",
        resultUrl:
          imageUrl ||
          `data:image/png;base64,${imageBase64}`,
      });

      return jsonResponse({
        success: true,
        generationId,
        imageUrl:
          imageUrl ||
          `data:image/png;base64,${imageBase64}`,
        imageBase64:
          imageBase64 ||
          undefined,
      });
    } catch (error) {
      if (
        generationId &&
        user?.id
      ) {
        try {
          await updateGeneration({
            generationId,
            userId:
              user.id,
            status:
              "failed",
            errorMessage:
              error instanceof Error
                ? error.message
                : "Image generation failed.",
          });
        } catch (
          refundError
        ) {
          console.error(
            "Generation update/refund failed:",
            refundError,
          );
        }
      }

      console.error(
        "image-generate error:",
        error,
      );

      return jsonResponse(
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
