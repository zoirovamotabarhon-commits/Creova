import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

async function openAIRequest(
  path: string,
  options: RequestInit = {}
) {
  return fetch(`${OPENAI_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      ...(options.headers ?? {}),
    },
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        Math.min(i + chunkSize, bytes.length)
      )
    );
  }

  return btoa(binary);
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
          error: "OPENAI_API_KEY is not configured.",
        },
        500
      );
    }

    const body = await req.json();

    const action =
      typeof body?.action === "string"
        ? body.action
        : "create";

    /*
     * CREATE
     */
    if (action === "create") {
      const prompt = body?.prompt;

      if (
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return jsonResponse(
          {
            success: false,
            error: "Prompt is required.",
          },
          400
        );
      }

      const response = await openAIRequest(
        "/videos",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "sora-2",
            prompt: prompt.trim(),
          }),
        }
      );

      const data = await response.json();

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
        status: data.status ?? "queued",
        progress:
          typeof data.progress === "number"
            ? data.progress
            : 0,
      });
    }

    /*
     * STATUS
     */
    if (action === "status") {
      const videoId = body?.videoId;

      if (
        typeof videoId !== "string" ||
        !videoId.trim()
      ) {
        return jsonResponse(
          {
            success: false,
            error: "Video ID is required.",
          },
          400
        );
      }

      const cleanVideoId = videoId.trim();

      const response = await openAIRequest(
        `/videos/${encodeURIComponent(cleanVideoId)}`,
        {
          method: "GET",
        }
      );

      const data = await response.json();

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

      const status = data.status ?? "unknown";

      if (
        status === "failed" ||
        status === "cancelled"
      ) {
        return jsonResponse({
          success: false,
          videoId: data.id,
          status,
          progress:
            typeof data.progress === "number"
              ? data.progress
              : 0,
          error:
            data?.error?.message ??
            `Video status: ${status}`,
        });
      }

      /*
       * VIDEO COMPLETED
       *
       * OpenAI's content endpoint returns the final MP4.
       */
      if (status === "completed") {
        const contentResponse =
          await openAIRequest(
            `/videos/${encodeURIComponent(
              cleanVideoId
            )}/content?variant=video`,
            {
              method: "GET",
              headers: {
                Accept: "video/mp4",
              },
            }
          );

        if (!contentResponse.ok) {
          const errorText =
            await contentResponse.text();

          return jsonResponse(
            {
              success: false,
              videoId: cleanVideoId,
              status: "completed",
              progress: 100,
              error:
                errorText ||
                "Video completed, but MP4 content is not available yet.",
            },
            contentResponse.status
          );
        }

        const contentType =
          contentResponse.headers.get(
            "content-type"
          ) ?? "";

        if (
          !contentType.includes("video/mp4")
        ) {
          return jsonResponse(
            {
              success: false,
              videoId: cleanVideoId,
              status: "completed",
              progress: 100,
              error:
                "Video content endpoint did not return MP4.",
            },
            502
          );
        }

        const videoBuffer =
          await contentResponse.arrayBuffer();

        if (!videoBuffer.byteLength) {
          return jsonResponse(
            {
              success: false,
              videoId: cleanVideoId,
              status: "completed",
              progress: 100,
              error:
                "Generated MP4 is empty.",
            },
            502
          );
        }

        const videoBase64 =
          arrayBufferToBase64(videoBuffer);

        return jsonResponse({
          success: true,
          videoId: cleanVideoId,
          status: "completed",
          progress: 100,
          videoUrl:
            `data:video/mp4;base64,${videoBase64}`,
        });
      }

      return jsonResponse({
        success: true,
        videoId: data.id,
        status,
        progress:
          typeof data.progress === "number"
            ? data.progress
            : 0,
      });
    }

    return jsonResponse(
      {
        success: false,
        error: "Unknown action.",
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
