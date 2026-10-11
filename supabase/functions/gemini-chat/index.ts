import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    // Qaysi nom bilan kelishidan qat'iy nazar promptni ushlab olamiz
    const prompt = body?.prompt || body?.message || body?.text || "";
    const history = body?.history || [];

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Gemini: bo'sh matn yo'q, tarix "user" bilan boshlanishi shart
    const chatHistory = Array.isArray(history)
      ? history
          .map((item: any) => ({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: String(item.text || item.prompt || "").trim() }],
          }))
          .filter((item: any) => item.parts[0].text.length > 0)
      : [];
    while (chatHistory.length && chatHistory[0].role !== "user") {
      chatHistory.shift();
    }

    let text = "";
    const primaryModelName = "gemini-3.8-flash";
    const fallbackModelName = "gemini-3.5-flash";

    try {
      const primaryModel = genAI.getGenerativeModel({ model: primaryModelName });
      const chat = primaryModel.startChat({
        history: chatHistory,
        generationConfig: { maxOutputTokens: 2048 },
      });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      text = response.text();
    } catch (primaryError: any) {
      console.warn(
        `Primary model (${primaryModelName}) failed, switching to fallback (${fallbackModelName}). Error:`,
        primaryError
      );

      try {
        const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
        const fallbackChat = fallbackModel.startChat({
          history: chatHistory,
          generationConfig: { maxOutputTokens: 2048 },
        });
        const fallbackResult = await fallbackChat.sendMessage(prompt);
        const fallbackResponse = await fallbackResult.response;
        text = fallbackResponse.text();
      } catch (fallbackError: any) {
        throw new Error(
          `All models failed. Primary: ${primaryError?.message}, Fallback: ${fallbackError?.message}`
        );
      }
    }

    return new Response(
      JSON.stringify({ text }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in gemini-chat function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
