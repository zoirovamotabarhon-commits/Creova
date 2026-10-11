import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function buildImagePart(imageBase64?: string, mimeType?: string, imageUri?: string) {
  if (imageBase64) {
    const clean = imageBase64.replace(/^data:[^;]+;base64,/, "");
    return { inlineData: { data: clean, mimeType: mimeType || "image/jpeg" } };
  }
  if (imageUri && /^https?:\/\//i.test(imageUri)) {
    const response = await fetch(imageUri);
    if (!response.ok) throw new Error(`Rasmni yuklab bo'lmadi (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      inlineData: {
        data: encode(bytes),
        mimeType: response.headers.get("content-type") || "image/jpeg",
      },
    };
  }
  throw new Error("Rasm yuborilmadi: file:// manzilni server o'qiy olmaydi, base64 yuboring.");
}

async function generateWithRetry(genAI: GoogleGenerativeAI, models: string[], parts: any[]) {
  let lastErr: any;
  for (const name of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const result = await model.generateContent(parts);
        return result.response.text();
      } catch (e: any) {
        lastErr = e;
        console.warn(`${name} attempt ${attempt + 1} failed:`, e?.status, e?.message);
        if (e?.status !== 503 && e?.status !== 429) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw new Error(`All models failed: ${lastErr?.message}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { prompt, imageUri, imageBase64, mimeType } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not configured.");

    if (!imageUri && !imageBase64) {
      throw new Error("Image is required for vision analysis.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const imagePart = await buildImagePart(imageBase64, mimeType, imageUri);
    const userPrompt = prompt || "Describe this image in detail.";

    const description = await generateWithRetry(
      genAI,
      ["gemini-3.8-flash", "gemini-3.5-flash"],
      [userPrompt, imagePart],
    );

    return new Response(JSON.stringify({ text: description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in vision-analyze function:", error);
    return new Response(JSON.stringify({ error: error.message || "Vision analysis failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
