import OpenAI from "npm:openai@6.49.0";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

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
          error: "Method not allowed",
        },
        405
      );
    }

    const body = await req.json();

    /*
     * VIDEO STATUS
     *
     * Агар videoId келса, мавжуд video generation
     * job ҳолатини текширамиз.
     */
    if (
      typeof body?.videoId === "string" &&
      body.videoId.trim()
    ) {
      const videoId = body.videoId.trim();

      const video = await openai.videos.retrieve(videoId);

      return jsonResponse({
        success: true,
        videoId: video.id,
        status: video.status,
        progress: video.progress ?? 0,
        error: video.error ?? null,
      });
    }

    /*
     * CREATE VIDEO
     *
     * Агар videoId берилмаган бўлса, prompt орқали
     * янги video generation job яратамиз.
     */
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

    const video = await openai.videos.create({
      model: "sora-2",
      prompt: prompt.trim(),
    });

    return jsonResponse({
      success: true,
      videoId: video.id,
      status: video.status,
      progress: video.progress ?? 0,
    });
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
