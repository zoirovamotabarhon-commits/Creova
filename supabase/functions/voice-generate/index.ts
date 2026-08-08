import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, i + chunkSize)
    );
  }

  return btoa(binary);
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { text } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Text is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    });

    const audioBuffer = await speech.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioBuffer);

    return new Response(
      JSON.stringify({
        success: true,
        audioUrl: `data:audio/mpeg;base64,${audioBase64}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
