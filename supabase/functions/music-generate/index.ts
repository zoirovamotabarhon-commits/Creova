import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ELEVENLABS_API_KEY =
  Deno.env.get("ELEVENLABS_API_KEY");

const ELEVENLABS_MUSIC_URL =
  "https://api.elevenlabs.io/v1/music";

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

    if (!ELEVENLABS_API_KEY) {
      return jsonResponse(
        {
          success: false,
          error: "ELEVENLABS_API_KEY is not configured.",
        },
        500
      );
    }

    const body = await req.json();
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

    const response = await fetch(
      ELEVENLABS_MUSIC_URL,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return jsonResponse(
        {
          success: false,
          error:
            errorText ||
            `ElevenLabs request failed with status ${response.status}.`,
        },
        response.status
      );
    }

    const audioBuffer =
      await response.arrayBuffer();

    const bytes = new Uint8Array(audioBuffer);

    let binary = "";

    const chunkSize = 0x8000;

    for (
      let i = 0;
      i < bytes.length;
      i += chunkSize
    ) {
      binary += String.fromCharCode(
        ...bytes.subarray(
          i,
          Math.min(i + chunkSize, bytes.length)
        )
      );
    }

    const audioBase64 = btoa(binary);

    return jsonResponse({
      success: true,
      audioUrl:
        `data:audio/mpeg;base64,${audioBase64}`,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Music generation failed.",
      },
      500
    );
  }
});
