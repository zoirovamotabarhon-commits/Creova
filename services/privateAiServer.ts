/**
 * CREOVA
 * privateAiServer
 *
 * AI calls go through Supabase Edge Functions rather than
 * calling provider APIs directly from the device.
 *
 * Provider API keys therefore never reach the client.
 *
 * This module provides a hardened primitive for calling
 * CREOVA's private AI Edge Functions:
 *
 *  - request timeout, so a hung network call can't leave
 *    the UI stuck
 *
 *  - a single retry for transient network errors only
 *
 *  - no retry after a server response has been received,
 *    which prevents accidental double charging
 *
 *  - one consistent result shape across Edge Functions
 */

import { invokeEdgeFunction } from "./edgeFunctions";

const DEFAULT_TIMEOUT_MS = 30000;

export interface PrivateAiServerResult<T = unknown> {
  success: boolean;

  data?: T;

  error?: string;
}

function isTransientNetworkError(
  message: string,
): boolean {
  const lowered =
    message.toLowerCase();

  return (
    lowered.includes("network") ||
    lowered.includes("timeout") ||
    lowered.includes("fetch failed")
  );
}

async function invokeOnce<T>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<PrivateAiServerResult<T>> {
  let timer:
    | ReturnType<typeof setTimeout>
    | undefined;

  const timeoutPromise =
    new Promise<never>(
      (_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `Request timeout after ${timeoutMs}ms.`,
            ),
          );
        }, timeoutMs);
      },
    );

  try {
    const { data, error } =
      await Promise.race([
        invokeEdgeFunction<
          Record<string, unknown>
        >(
          functionName,
          {
            body,
          },
        ),

        timeoutPromise,
      ]);

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (
      data &&
      data.success === false
    ) {
      return {
        success: false,

        error:
          typeof data.error ===
          "string"
            ? data.error
            : "Request failed.",
      };
    }

    return {
      success: true,
      data: data as T,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error";

    return {
      success: false,
      error: message,
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Calls a CREOVA AI Edge Function with a timeout
 * and one retry for transient network failures.
 *
 * A request is never retried after a server response
 * has been received, preventing duplicate paid
 * generations.
 */
export async function callPrivateAiFunction<
  T = unknown,
>(
  functionName: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<PrivateAiServerResult<T>> {
  const first =
    await invokeOnce<T>(
      functionName,
      body,
      timeoutMs,
    );

  if (
    first.success ||
    !first.error ||
    !isTransientNetworkError(
      first.error,
    )
  ) {
    return first;
  }

  return invokeOnce<T>(
    functionName,
    body,
    timeoutMs,
  );
}
