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
          error: "Prompt is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt.trim(),
      size: "1024x1024",
    });

    const imageData = response.data?.[0];

    if (!imageData) {
      throw new Error("Image generation returned no image.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: imageData.url ?? "",
        imageBase64: imageData.b64_json ?? "",
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
            : "Unknown error",
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
