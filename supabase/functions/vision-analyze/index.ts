import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fileToGenerativePart(imageUri: string) {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  return {
    inlineData: {
      data: base64Data,
      mimeType: blob.type || "image/jpeg",
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const { prompt, imageUri } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }

    if (!imageUri) {
      throw new Error("Image URI is required for vision analysis.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const imagePart = await fileToGenerativePart(imageUri);
    const userPrompt = prompt || "Describe this image in detail.";

    let description = "";
    const primaryModelName = "gemini-3.8-flash";
    const fallbackModelName = "gemini-3.5-flash";

    try {
      const primaryModel = genAI.getGenerativeModel({ model: primaryModelName });
      const result = await primaryModel.generateContent([userPrompt, imagePart]);
      const response = await result.response;
      description = response.text();
    } catch (primaryError) {
      console.warn(`Primary vision model (${primaryModelName}) failed, switching to fallback (${fallbackModelName}). Error:`, primaryError);

      const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
      const fallbackResult = await fallbackModel.generateContent([userPrompt, imagePart]);
      const fallbackResponse = await fallbackResult.response;
      description = fallbackResponse.text();
    }

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
