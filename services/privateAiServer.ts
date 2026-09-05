/**
 * CREOVA
 * privateAiServer
 *
 * Every AI call already goes through Supabase Edge Functions
 * (openai-chat, image-generate, etc.) rather than hitting OpenAI directly
 * from the device — so provider API keys never reach the client. This
 * module is a thin, hardened primitive for calling those functions:
 *
 *  - request timeout, so a hung network call can't leave the UI stuck
 *    (and can't leave a coin charge in limbo)
 *  - a single retry for transient network errors only (never retries
 *    after the server already started processing a paid generation)
 *  - one consistent result shape across every function name
 *
 * Existing services (services/openai.ts, services/image.ts, ...) are left
 * as-is; new AI-calling code should prefer this instead of calling
 * supabase.functions.invoke directly.
 */

import { supabase } from "./supabase";

const DEFAULT_TIMEOUT_MS = 30000;

export interface PrivateAiServerResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

function isTransientNetworkError(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes("network") ||
    lowered.includes("timeout") ||
    lowered.includes("fetch failed")
  );
}

async function invokeOnce<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<PrivateAiServerResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.error ?? "Request failed." };
    }

    return { success: true, data: data as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls a Creova AI edge function with a timeout and one retry for
 * transient network failures. Does not retry after any response was
 * received from the server, paid or not, to avoid double-charging.
 */
export async function callPrivateAiFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<PrivateAiServerResult<T>> {
  const first = await invokeOnce<T>(functionName, body, timeoutMs);

  if (first.success || !first.error || !isTransientNetworkError(first.error)) {
    return first;
  }

  return invokeOnce<T>(functionName, body, timeoutMs);
}
