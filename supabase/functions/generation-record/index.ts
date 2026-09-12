import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/rateLimiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(
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
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type GenerationType =
  | "chat"
  | "code"
  | "image"
  | "video"
  | "music"
  | "voice";

interface RequestBody {
  generationId: string;
  type: GenerationType;
  prompt?: string;
  metadata?: Record<string, unknown>;
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

function isValidGenerationId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 10 &&
    value.length <= 100
  );
}

function isValidType(value: unknown): value is GenerationType {
  return [
    "chat",
    "code",
    "image",
    "video",
    "music",
    "voice",
  ].includes(value as string);
}

async function getUserFromRequest(
  request: Request,
): Promise<{ id: string } | null> {
  const authorization = request.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.replace("Bearer ", "").trim();

  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized",
        },
        401,
      );
    }

    let body: RequestBody;

    try {
      body = await request.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON body",
        },
        400,
      );
    }

    if (!isValidGenerationId(body.generationId)) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid generationId",
        },
        400,
      );
    }

    if (!isValidType(body.type)) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid generation type",
        },
        400,
      );
    }

    const prompt =
      typeof body.prompt === "string"
        ? body.prompt.trim()
        : "";

    if (prompt.length > 50000) {
      return jsonResponse(
        {
          success: false,
          error: "Prompt is too long",
        },
        400,
      );
    }

    /*
     * Rate-limit generation CREATION.
     *
     * The provider functions do not rate-limit again because doing so
     * could double-charge/block an already-created generation.
     */
    const rateLimit = await checkRateLimit(
      supabaseAdmin,
      user.id,
      "generation-create",
      20,
      60,
    );

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const metadata =
      body.metadata &&
      typeof body.metadata === "object" &&
      !Array.isArray(body.metadata)
        ? body.metadata
        : {};

    /*
     * All charging happens inside the SECURITY DEFINER SQL function.
     *
     * This keeps wallet deduction + generation creation atomic.
     */
    const { data, error } = await supabaseAdmin.rpc(
      "create_generation_with_charge",
      {
        p_generation_id: body.generationId,
        p_user_id: user.id,
        p_type: body.type,
        p_prompt: prompt || null,
        p_metadata: metadata,
      },
    );

    if (error) {
      console.error(
        "create_generation_with_charge failed:",
        error,
      );

      /*
       * If the generation already exists, return it only when it belongs
       * to this authenticated user. Never expose another user's record.
       */
      const { data: existing, error: existingError } =
        await supabaseAdmin
          .from("generation_history")
          .select(
            "id,user_id,type,status,prompt,metadata,created_at,updated_at",
          )
          .eq("id", body.generationId)
          .eq("user_id", user.id)
          .maybeSingle();

      if (!existingError && existing) {
        if (existing.type !== body.type) {
          return jsonResponse(
            {
              success: false,
              error: "Generation type mismatch",
            },
            409,
          );
        }

        return jsonResponse({
          success: true,
          existing: true,
          generation: existing,
        });
      }

      return jsonResponse(
        {
          success: false,
          error: error.message || "Unable to create generation",
        },
        400,
      );
    }

    let generation = data;

    /*
     * Supabase RPC can return either a single object or an array depending
     * on the SQL function definition/client behavior.
     */
    if (Array.isArray(data)) {
      generation = data[0] ?? null;
    }

    if (!generation) {
      return jsonResponse(
        {
          success: false,
          error: "Generation was not created",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      existing: false,
      generation,
    });
  } catch (error) {
    console.error("generation-record error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      500,
    );
  }
});
