import { createClient } from "npm:@supabase/supabase-js@2.57.0";

/**
 * CREOVA
 * Shared rate limiter for edge functions.
 *
 * Edge functions are stateless between invocations, so an in-memory
 * counter would not work — a single misbehaving client (bug or abuse)
 * could otherwise fire unlimited paid AI calls. This uses a small
 * Postgres table (see supabase/migrations/20260905_atomic_coin_transaction.sql)
 * as the shared counter, with a fixed time window per (user, action).
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAtMs: number;
}

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Checks and atomically increments the counter for `(userId, action)` in
 * one round trip via the `check_and_increment_rate_limit` SQL function,
 * so two concurrent requests can't both slip through the same limit.
 *
 * `windowSeconds` defines the fixed window size (e.g. 60 for "per minute").
 * Fails open (allowed: true) if the rate limit table/function is
 * unreachable, so a database hiccup never takes the whole app down —
 * the coin/credit system remains the hard spending limit either way.
 */
export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const admin = getAdminClient();

    const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
      p_user_id: userId,
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error || !data) {
      console.error("Rate limit check failed, failing open:", error?.message);
      return {
        allowed: true,
        remaining: limit,
        limit,
        resetAtMs: Date.now() + windowSeconds * 1000,
      };
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      limit,
      resetAtMs: new Date(data.reset_at).getTime(),
    };
  } catch (err) {
    console.error("Rate limiter error, failing open:", err);
    return {
      allowed: true,
      remaining: limit,
      limit,
      resetAtMs: Date.now() + windowSeconds * 1000,
    };
  }
}

/**
 * Convenience helper returning a ready-to-send 429 Response when the
 * caller is over the limit, or null when the request may proceed.
 */
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.allowed) {
    return null;
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "Too many requests. Please slow down and try again shortly.",
      resetAt: new Date(result.resetAtMs).toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, Math.ceil((result.resetAtMs - Date.now()) / 1000))),
      },
    }
  );
  }
