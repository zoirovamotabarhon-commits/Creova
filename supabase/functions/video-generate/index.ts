import OpenAI from "npm:openai@6.49.0";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

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
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const body = await req.json();
    const prompt = body?.prompt;

    if (typeof prompt !== "string" || !prompt.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Prompt is required.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const video = await openai.videos.create({
      model: "sora-2",
      prompt: prompt.trim(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        videoId: video.id,
        status: video.status,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Video generation failed.",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});
