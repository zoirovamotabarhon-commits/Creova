import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

import { supabase } from "./supabase";

/**
 * CREOVA
 *
 * Thin wrapper around supabase.functions.invoke().
 *
 * WHY THIS EXISTS
 * ----------------
 * When a Supabase Edge Function returns a non-2xx status (400,
 * 401, 429, 500, ...), the JS SDK does NOT read the function's
 * JSON body for you. `error.message` on the object it returns is
 * always the generic string:
 *
 *   "Edge Function returned a non-2xx status code"
 *
 * Every CREOVA edge function already returns a real, specific
 * reason in its body, e.g.:
 *
 *   { success: false, error: "Insufficient coin balance." }
 *   { success: false, error: "Monthly AI generation limit (10) reached for the free plan." }
 *   { success: false, error: "OPENAI_API_KEY is not configured." }
 *
 * Every service in this app (chat.ts, image.ts, video.ts, ...)
 * ultimately returned `error.message` straight from the SDK, so
 * the app only ever showed the generic sentence above instead of
 * the actual reason - which is exactly what the CREOVA AI chat
 * screen showed when a new user's wallet had no balance.
 *
 * HOW TO USE
 * ----------
 * Drop-in replacement for `supabase.functions.invoke`: same
 * arguments, same `{ data, error }` return shape, so existing
 * call sites that do `if (error) return { error: error.message }`
 * keep working unchanged - `error.message` now contains the real
 * server-side reason instead of the generic SDK string.
 */

export interface EdgeFunctionError extends Error {
  /** HTTP status returned by the edge function, when known. */
  status?: number;
}

interface InvokeEdgeFunctionOptions {
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface InvokeEdgeFunctionResult<T> {
  data: T | null;
  error: EdgeFunctionError | null;
}

export async function invokeEdgeFunction<T = Record<string, unknown>>(
  functionName: string,
  options: InvokeEdgeFunctionOptions = {},
): Promise<InvokeEdgeFunctionResult<T>> {
  const { data, error } = await supabase.functions.invoke<T>(
    functionName,
    options,
  );

  if (!error) {
    return { data: (data ?? null) as T | null, error: null };
  }

  return { data: null, error: await unwrapEdgeFunctionError(error) };
}

async function unwrapEdgeFunctionError(
  error: unknown,
): Promise<EdgeFunctionError> {
  /*
   * The function executed and responded, but with a non-2xx
   * status. The real reason lives in the JSON body.
   */
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();

      const message =
        body &&
        typeof body === "object" &&
        typeof (body as { error?: unknown }).error === "string"
          ? (body as { error: string }).error
          : error.message;

      const unwrapped = new Error(message) as EdgeFunctionError;
      unwrapped.status = error.context.status;
      return unwrapped;
    } catch {
      /*
       * Body wasn't JSON, or couldn't be read a second time -
       * fall back to the SDK's own message rather than throwing
       * from inside error handling.
       */
      const fallback = error as EdgeFunctionError;
      fallback.status = error.context?.status;
      return fallback;
    }
  }

  /*
   * The function itself could not be reached or crashed before
   * responding (network issue, function not deployed, CORS,
   * timeout). These already carry a useful, specific message -
   * nothing to unwrap.
   */
  if (
    error instanceof FunctionsRelayError ||
    error instanceof FunctionsFetchError
  ) {
    return error as EdgeFunctionError;
  }

  return error instanceof Error
    ? (error as EdgeFunctionError)
    : (new Error("An unknown error occurred.") as EdgeFunctionError);
}
