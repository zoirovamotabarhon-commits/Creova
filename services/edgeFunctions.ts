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
 * When a Supabase Edge Function returns a non-2xx status,
 * supabase-js may expose only a generic SDK error message.
 *
 * CREOVA Edge Functions return their real reason in the
 * JSON response body, for example:
 *
 *   { success: false, error: "Insufficient coin balance." }
 *   { success: false, error: "Monthly AI generation limit reached." }
 *   { success: false, error: "Gemini API key is not configured." }
 *
 * This wrapper extracts that server-side message and makes
 * it available to the application as error.message.
 */

export interface EdgeFunctionError
  extends Error {
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

export async function invokeEdgeFunction<
  T = Record<string, unknown>,
>(
  functionName: string,
  options: InvokeEdgeFunctionOptions = {},
): Promise<
  InvokeEdgeFunctionResult<T>
> {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke<T>(
      functionName,
      options,
    );

  if (!error) {
    return {
      data:
        (data ?? null) as
          | T
          | null,

      error: null,
    };
  }

  return {
    data: null,

    error:
      await unwrapEdgeFunctionError(
        error,
      ),
  };
}

async function unwrapEdgeFunctionError(
  error: unknown,
): Promise<EdgeFunctionError> {
  if (
    error instanceof
    FunctionsHttpError
  ) {
    try {
      const body: unknown =
        await error.context.json();

      const message =
        body &&
        typeof body ===
          "object" &&
        typeof (
          body as {
            error?: unknown;
          }
        ).error ===
          "string"
          ? (
              body as {
                error: string;
              }
            ).error
          : error.message;

      const unwrapped =
        new Error(
          message,
        ) as EdgeFunctionError;

      unwrapped.status =
        error.context.status;

      return unwrapped;
    } catch {
      const fallback =
        error as EdgeFunctionError;

      fallback.status =
        error.context?.status;

      return fallback;
    }
  }

  if (
    error instanceof
      FunctionsRelayError ||
    error instanceof
      FunctionsFetchError
  ) {
    return error as EdgeFunctionError;
  }

  return error instanceof Error
    ? (error as EdgeFunctionError)
    : (new Error(
        "An unknown error occurred.",
      ) as EdgeFunctionError);
}
