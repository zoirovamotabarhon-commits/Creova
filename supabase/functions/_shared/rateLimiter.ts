import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc(
    'check_and_increment_rate_limit',
    {
      p_user_id: userId,
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    },
  );

  if (error) {
    console.error('Rate limiter error:', error);

    // Security-sensitive operation:
    // fail closed instead of allowing unlimited requests.
    return {
      allowed: false,
      remaining: 0,
    };
  }

  const result = Array.isArray(data) ? data[0] : data;

  return {
    allowed: Boolean(result?.allowed),
    remaining: Number(result?.remaining ?? 0),
  };
}

/**
 * Builds the standard 429 response returned by edge functions when
 * checkRateLimit() reports the caller is over their limit. Kept here (next
 * to checkRateLimit) so every function that rate-limits returns an
 * identically-shaped response.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      remaining: result.remaining,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
  }
