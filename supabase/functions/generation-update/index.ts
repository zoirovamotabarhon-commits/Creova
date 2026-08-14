import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

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

const TERMINAL_STATUSES = [
  "completed",
  "failed",
  "cancelled",
] as const;

const ALL_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
] as const;

type GenerationStatus =
  (typeof ALL_STATUSES)[number];

function response(
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

function isValidStatus(
  value: unknown,
): value is GenerationStatus {
  return (
    typeof value === "string" &&
    ALL_STATUSES.includes(
      value as GenerationStatus,
    )
  );
}

function canTransition(
  current: GenerationStatus,
  next: GenerationStatus,
) {
  if (current === next) {
    return true;
  }

  if (
    TERMINAL_STATUSES.includes(
      current as (typeof TERMINAL_STATUSES)[number],
    )
  ) {
    return false;
  }

  if (current === "queued") {
    return [
      "processing",
      "completed",
      "failed",
      "cancelled",
    ].includes(next);
  }

  if (current === "processing") {
    return [
      "completed",
      "failed",
      "cancelled",
    ].includes(next);
  }

  return false;
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
      return response(
        {
          success: false,
          error:
            "Method not allowed.",
        },
        405,
      );
    }

    try {
      const user =
        await requireUser(
          req,
        );

      if (!user) {
        return response(
          {
            success: false,
            error:
              "Authentication required.",
          },
          401,
        );
      }

      const body =
        (await req.json()) as Record<
          string,
          unknown
        >;

      const generationId =
        typeof body.generationId ===
        "string"
          ? body.generationId.trim()
          : "";

      const requestedStatus =
        body.status;

      if (!generationId) {
        return response(
          {
            success: false,
            error:
              "Generation ID is required.",
          },
          400,
        );
      }

      if (
        !isValidStatus(
          requestedStatus,
        )
      ) {
        return response(
          {
            success: false,
            error:
              "Invalid generation status.",
          },
          400,
        );
      }

      /*
       * Client applications are not allowed
       * to mark a generation as completed,
       * failed or cancelled.
       *
       * Those states are controlled by the
       * generation Edge Functions.
       */
      if (
        TERMINAL_STATUSES.includes(
          requestedStatus as (typeof TERMINAL_STATUSES)[number],
        )
      ) {
        return response(
          {
            success: false,
            error:
              "Terminal generation status is server-controlled.",
          },
          403,
        );
      }

      const supabase =
        getAdminClient();

      const {
        data: generation,
        error: readError,
      } =
        await supabase
          .from("generation_history")
          .select("*")
          .eq("id", generationId)
          .eq(
            "user_id",
            user.id,
          )
          .maybeSingle();

      if (readError) {
        throw readError;
      }

      if (!generation) {
        return response(
          {
            success: false,
            error:
              "Generation not found.",
          },
          404,
        );
      }

      const currentStatus =
        generation.status;

      if (
        !isValidStatus(
          currentStatus,
        )
      ) {
        throw new Error(
          "Stored generation status is invalid.",
        );
      }

      if (
        !canTransition(
          currentStatus,
          requestedStatus,
        )
      ) {
        return response(
          {
            success: false,
            error:
              `Invalid status transition: ${currentStatus} -> ${requestedStatus}.`,
          },
          409,
        );
      }

      const { data, error } =
        await supabase
          .from("generation_history")
          .update({
            status:
              requestedStatus,
            started_at:
              requestedStatus ===
                "processing" &&
              !generation.started_at
                ? new Date().toISOString()
                : generation.started_at,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            generationId,
          )
          .eq(
            "user_id",
            user.id,
          )
          .select()
          .single();

      if (error) {
        throw error;
      }

      return response({
        success: true,
        generationId,
        status:
          data.status,
        generation:
          data,
      });
    } catch (error) {
      console.error(
        "generation-update error:",
        error,
      );

      return response(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Generation update failed.",
        },
        500,
      );
    }
  },
);
