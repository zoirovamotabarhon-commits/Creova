import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY =
  Deno.env.get("OPENAI_API_KEY");

const OPENAI_BASE_URL =
  "https://api.openai.com/v1";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    }
  );
}

async function openAIRequest(
  path: string,
  options: RequestInit = {}
) {
  return fetch(
    `${OPENAI_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        Authorization:
          `Bearer ${OPENAI_API_KEY}`,
        "Content-Type":
          "application/json",
        ...(options.headers ?? {}),
      },
    }
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse(
        {
          success: false,
          error: "Method not allowed.",
        },
        405
      );
    }

    if (!OPENAI_API_KEY) {
      return jsonResponse(
        {
          success: false,
          error:
            "OPENAI_API_KEY is not configured.",
        },
        500
      );
    }

    const body =
      await req.json();

    const action =
      typeof body?.action === "string"
        ? body.action
        : "create";

    // CREATE VIDEO
    if (action === "create") {
      const prompt = body?.prompt;

      if (
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Prompt is required.",
          },
          400
        );
      }

      const response =
        await openAIRequest(
          "/videos",
          {
            method: "POST",
            body: JSON.stringify({
              model: "sora-2",
              prompt:
                prompt.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            success: false,
            error:
              data?.error?.message ??
              "Video generation failed.",
          },
          response.status
        );
      }

      return jsonResponse({
        success: true,
        videoId: data.id,
        status:
          data.status ?? "queued",
        progress:
          typeof data.progress ===
          "number"
            ? data.progress
            : 0,
      });
    }

    // CHECK STATUS
    if (action === "status") {
      const videoId =
        body?.videoId;

      if (
        typeof videoId !== "string" ||
        !videoId.trim()
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Video ID is required.",
          },
          400
        );
      }

      const response =
        await openAIRequest(
          `/videos/${encodeURIComponent(
            videoId.trim()
          )}`,
          {
            method: "GET",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        return jsonResponse(
          {
            success: false,
            error:
              data?.error?.message ??
              "Unable to retrieve video status.",
          },
          response.status
        );
      }

      const status =
        data.status ?? "unknown";

      if (
        status === "failed" ||
        status === "cancelled"
      ) {
        return jsonResponse({
          success: false,
          videoId: data.id,
          status,
          progress:
            typeof data.progress ===
            "number"
              ? data.progress
              : 0,
          error:
            data?.error?.message ??
            `Video status: ${status}`,
        });
      }

      return jsonResponse({
        success: true,
        videoId: data.id,
        status,
        progress:
          typeof data.progress ===
          "number"
            ? data.progress
            : status === "completed"
              ? 100
              : 0,
      });
    }

    return jsonResponse(
      {
        success: false,
        error:
          "Unknown action.",
      },
      400
    );
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Video operation failed.",
      },
      500
    );
  }
});
