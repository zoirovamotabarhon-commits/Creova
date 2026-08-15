import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
} from "npm:@supabase/supabase-js@2.57.0";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
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
      .slice(7)
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

function isUuid(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isOperation(
  value: unknown,
): value is "charge" | "refund" {
  return (
    value === "charge" ||
    value === "refund"
  );
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

    try {
      const user =
        await requireUser(req);

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

      const operation =
        body.operation;

      if (!isOperation(operation)) {
        return json(
          {
            success: false,
            error:
              "Operation must be charge or refund.",
          },
          400,
        );
      }

      const amount =
        Number(body.amount);

      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
      ) {
        return json(
          {
            success: false,
            error:
              "Amount must be a positive integer.",
          },
          400,
        );
      }

      const referenceId =
        typeof body.referenceId ===
        "string"
          ? body.referenceId.trim()
          : "";

      if (
        !isUuid(referenceId)
      ) {
        return json(
          {
            success: false,
            error:
              "Valid reference ID is required.",
          },
          400,
        );
      }

      const reason =
        typeof body.reason ===
        "string"
          ? body.reason.trim()
          : "generation";

      const description =
        typeof body.description ===
        "string"
          ? body.description.trim()
          : `CREOVA ${operation}`;

      const metadata =
        body.metadata &&
        typeof body.metadata ===
          "object" &&
        !Array.isArray(
          body.metadata,
        )
          ? body.metadata
          : {};

      const transactionType =
        operation === "charge"
          ? "debit"
          : "credit";

      const admin =
        getAdminClient();

      const {
        data,
        error,
      } =
        await admin.rpc(
          "change_wallet_balance",
          {
            p_user_id:
              user.id,
            p_amount:
              amount,
            p_transaction_type:
              transactionType,
            p_reason:
              reason,
            p_reference_id:
              referenceId,
            p_description:
              description,
            p_metadata:
              metadata,
          },
        );

      if (error) {
        return json(
          {
            success: false,
            error:
              error.message,
          },
          400,
        );
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!result) {
        throw new Error(
          "Wallet operation returned no result.",
        );
      }

      return json({
        success: true,
        operation,
        transactionType,
        transactionId:
          result.transaction_id ??
          result.id ??
          null,
        previousBalance:
          Number(
            result.previous_balance ??
              0,
          ),
        amount,
        newBalance:
          Number(
            result.new_balance ??
              0,
          ),
      });
    } catch (error) {
      console.error(
        "coin-operation error:",
        error,
      );

      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Coin operation failed.",
        },
        500,
      );
    }
  },
);
