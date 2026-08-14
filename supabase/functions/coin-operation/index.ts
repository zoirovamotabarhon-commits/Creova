import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const COSTS = {
  chat: 1,
  code: 2,
  image: 5,
  video: 15,
  music: 10,
  voice: 5,
} as const;

type GenerationType =
  keyof typeof COSTS;

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

function isValidUuid(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isGenerationType(
  value: unknown,
): value is GenerationType {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      COSTS,
      value,
    )
  );
}

function normalizeMetadata(
  value: unknown,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<
    string,
    unknown
  >;
}

function getAdminClient() {
  if (
    !SUPABASE_URL ||
    !SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase server configuration is missing.",
    );
  }

  return createClient(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
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
      .slice("Bearer ".length)
      .trim();

  if (!token) {
    return null;
  }

  const admin =
    getAdminClient();

  const {
    data,
    error,
  } =
    await admin.auth.getUser(
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

      userId = user.id;

      let body: Record<
        string,
        unknown
      >;

      try {
        body =
          (await req.json()) as Record<
            string,
            unknown
          >;
      } catch {
        return json(
          {
            success: false,
            error:
              "Invalid JSON request body.",
          },
          400,
        );
      }

      generationId =
        typeof body.generationId ===
        "string"
          ? body.generationId.trim()
          : "";

      if (
        !isValidUuid(
          generationId,
        )
      ) {
        return json(
          {
            success: false,
            error:
              "Valid generation ID is required.",
          },
          400,
        );
      }

      const type =
        body.type;

      if (
        !isGenerationType(type)
      ) {
        return json(
          {
            success: false,
            error:
              "Invalid generation type.",
          },
          400,
        );
      }

      const prompt =
        typeof body.prompt ===
        "string"
          ? body.prompt.trim()
          : "";

      if (!prompt) {
        return json(
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
        return json(
          {
            success: false,
            error:
              "Prompt is too long.",
          },
          400,
        );
      }

      const admin =
        getAdminClient();

      const {
        data: existing,
        error:
          existingError,
      } =
        await admin
          .from(
            "generation_history",
          )
          .select("*")
          .eq("id", generationId)
          .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        if (
          existing.user_id !==
          userId
        ) {
          return json(
            {
              success: false,
              error:
                "Generation does not belong to the authenticated user.",
            },
            403,
          );
        }

        if (
          existing.type !== type
        ) {
          return json(
            {
              success: false,
              error:
                "Generation type does not match the existing record.",
            },
            409,
          );
        }

        return json({
          success: true,
          generationId,
          generation:
            existing,
          reused: true,
        });
      }

      const cost =
        COSTS[type];

      const metadata = {
        ...normalizeMetadata(
          body.metadata,
        ),
        coinCost: cost,
      };

      const {
        data: chargeData,
        error:
          chargeError,
      } =
        await admin.rpc(
          "change_wallet_balance",
          {
            p_user_id: userId,
            p_amount: cost,
            p_transaction_type:
              "debit",
            p_reason:
              "generation",
            p_reference_id:
              generationId,
            p_description:
              `CREOVA ${type} generation`,
            p_metadata: {
              source:
                "generation-record",
              generationType:
                type,
            },
          },
        );

      if (chargeError) {
        return json(
          {
            success: false,
            error:
              chargeError.message,
          },
          400,
        );
      }

      const charge =
        Array.isArray(chargeData)
          ? chargeData[0]
          : chargeData;

      if (!charge) {
        throw new Error(
          "Coin operation returned no result.",
        );
      }

      const {
        data: generation,
        error:
          insertError,
      } =
        await admin
          .from(
            "generation_history",
          )
          .insert({
            id:
              generationId,
            user_id:
              userId,
            type,
            prompt,
            status:
              "queued",
            metadata,
          })
          .select()
          .single();

      if (insertError) {
        try {
          await admin.rpc(
            "change_wallet_balance",
            {
              p_user_id:
                userId,
              p_amount:
                cost,
              p_transaction_type:
                "credit",
              p_reason:
                "refund",
              p_reference_id:
                generationId,
              p_description:
                "Automatic refund after generation record creation failed.",
              p_metadata: {
                source:
                  "generation-record",
                reason:
                  "record-insert-failed",
              },
            },
          );
        } catch (
          refundError
        ) {
          console.error(
            "Automatic refund failed:",
            refundError,
          );
        }

        throw insertError;
      }

      return json(
        {
          success: true,
          generationId,
          generation,
          coinCost: cost,
          newBalance:
            Number(
              charge.new_balance,
            ),
        },
        201,
      );
    } catch (error) {
      console.error(
        "generation-record error:",
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
              : "Generation record creation failed.",
        },
        500,
      );
    }
  },
);
