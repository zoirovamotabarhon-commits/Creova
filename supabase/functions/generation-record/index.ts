import {
  createClient,
} from "https://esm.sh/@supabase/supabase-js@2";

import {
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/rateLimiter.ts";

const SUPABASE_URL =
  Deno.env.get(
    "SUPABASE_URL",
  );

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  ) ??
  Deno.env.get(
    "SUPABASE_SECRET_KEY",
  );

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error(
    "Missing Supabase environment variables",
  );
}

const supabaseAdmin =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

const corsHeaders = {
  "Access-Control-Allow-Origin":
    "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",

  "Content-Type":
    "application/json",
};

type GenerationType =
  | "chat"
  | "code"
  | "image"
  | "video"
  | "music"
  | "voice"
  | "vision";

interface RequestBody {
  generationId: string;

  type: GenerationType;

  prompt?: string;

  metadata?: Record<
    string,
    unknown
  >;
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<
    string,
    string
  > = {},
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,
        ...extraHeaders,
      },
    },
  );
}

function isValidGenerationId(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= 10 &&
    value.length <= 100
  );
}

function isValidType(
  value: unknown,
): value is GenerationType {
  return (
    value === "chat" ||
    value === "code" ||
    value === "image" ||
    value === "video" ||
    value === "music" ||
    value === "voice" ||
    value === "vision"
  );
}

async function getUserFromRequest(
  request: Request,
): Promise<
  { id: string } | null
> {
  const authorization =
    request.headers.get(
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
      .slice(
        "Bearer ".length,
      )
      .trim();

  if (!token) {
    return null;
  }

  const {
    data,
    error,
  } =
    await supabaseAdmin.auth.getUser(
      token,
    );

  if (
    error ||
    !data.user
  ) {
    return null;
  }

  return {
    id: data.user.id,
  };
}

Deno.serve(
  async (request) => {
    /*
     * CORS preflight.
     */
    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          status: 200,
          headers:
            corsHeaders,
        },
      );
    }

    /*
     * Only POST is allowed.
     */
    if (
      request.method !==
      "POST"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Method not allowed",
        },
        405,
      );
    }

    try {
      /*
       * Authenticate user.
       */
      const user =
        await getUserFromRequest(
          request,
        );

      if (!user) {
        return jsonResponse(
          {
            success: false,
            error:
              "Unauthorized",
          },
          401,
        );
      }

      /*
       * Parse request body.
       */
      let body: RequestBody;

      try {
        body =
          await request.json();
      } catch {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid JSON body",
          },
          400,
        );
      }

      /*
       * Validate generation ID.
       */
      if (
        !isValidGenerationId(
          body.generationId,
        )
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid generationId",
          },
          400,
        );
      }

      /*
       * Validate generation type.
       *
       * Vision is explicitly supported.
       */
      if (
        !isValidType(
          body.type,
        )
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid generation type",
          },
          400,
        );
      }

      /*
       * Normalize prompt.
       */
      const prompt =
        typeof body.prompt ===
        "string"
          ? body.prompt.trim()
          : "";

      /*
       * Prevent oversized prompts.
       */
      if (
        prompt.length >
        50000
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Prompt is too long",
          },
          400,
        );
      }

      /*
       * Rate limit generation creation.
       *
       * 20 requests / 60 seconds / user.
       */
      const rateLimit =
        await checkRateLimit(
          supabaseAdmin,
          user.id,
          "generation-create",
          20,
          60,
        );

      if (
        !rateLimit.allowed
      ) {
        return rateLimitResponse(
          rateLimit,
        );
      }

      /*
       * Metadata must be a plain object.
       */
      const metadata =
        body.metadata &&
        typeof body.metadata ===
          "object" &&
        !Array.isArray(
          body.metadata,
        )
          ? body.metadata
          : {};

      /*
       * Atomically:
       *
       * 1. charge user
       * 2. create generation_history row
       */
      const {
        data,
        error,
      } =
        await supabaseAdmin.rpc(
          "create_generation_with_charge",
          {
            p_generation_id:
              body.generationId,

            p_user_id:
              user.id,

            p_type:
              body.type,

            p_prompt:
              prompt || null,

            p_metadata:
              metadata,
          },
        );

      /*
       * Handle RPC failure.
       */
      if (error) {
        console.error(
          "create_generation_with_charge failed:",
          error,
        );

        /*
         * It is possible that the generation was
         * already created. Check before returning
         * an error.
         */
        const {
          data: existing,
          error:
            existingError,
        } =
          await supabaseAdmin
            .from(
              "generation_history",
            )
            .select(
              "id,user_id,type,status,prompt,metadata,created_at,updated_at",
            )
            .eq(
              "id",
              body.generationId,
            )
            .eq(
              "user_id",
              user.id,
            )
            .maybeSingle();

        if (
          !existingError &&
          existing
        ) {
          /*
           * Never allow a caller to reuse an ID
           * with another generation type.
           */
          if (
            existing.type !==
            body.type
          ) {
            return jsonResponse(
              {
                success:
                  false,

                error:
                  "Generation type mismatch",
              },
              409,
            );
          }

          return jsonResponse(
            {
              success: true,

              existing: true,

              generation:
                existing,
            },
          );
        }

        return jsonResponse(
          {
            success: false,

            error:
              error.message ||
              "Unable to create generation",
          },
          400,
        );
      }

      /*
       * Supabase RPC may return an object
       * or an array depending on the function
       * result shape.
       */
      let generation =
        data;

      if (
        Array.isArray(data)
      ) {
        generation =
          data[0] ??
          null;
      }

      if (
        !generation
      ) {
        return jsonResponse(
          {
            success: false,

            error:
              "Generation was not created",
          },
          500,
        );
      }

      /*
       * Success.
       */
      return jsonResponse(
        {
          success: true,

          existing: false,

          generation,
        },
      );
    } catch (error) {
      console.error(
        "generation-record error:",
        error,
      );

      return jsonResponse(
        {
          success: false,

          error:
            error instanceof
            Error
              ? error.message
              : "Internal server error",
        },
        500,
      );
    }
  },
);
