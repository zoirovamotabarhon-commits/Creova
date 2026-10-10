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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const { prompt, history } = await req.json();
    
    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in environment variables");
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const chatHistory = Array.isArray(history) ? history.map((item: any) => ({
      role: item.role === "user" ? "user" : "model",
      parts: [{ text: item.text }]
    })) : [];

    let text = "";
    const primaryModelName = "gemini-3.8-flash";
    const fallbackModelName = "gemini-3.5-flash";

    // Try primary model first, fallback to secondary if overloaded or fails
    try {
      const primaryModel = genAI.getGenerativeModel({ model: primaryModelName });
      const chat = primaryModel.startChat({
        history: chatHistory,
        generationConfig: { maxOutputTokens: 2048 },
      });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      text = response.text();
    } catch (primaryError) {
      console.warn(`Primary model (${primaryModelName}) failed, switching to fallback (${fallbackModelName}). Error:`, primaryError);
      
      const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
      const fallbackChat = fallbackModel.startChat({
        history: chatHistory,
        generationConfig: { maxOutputTokens: 2048 },
      });
      const fallbackResult = await fallbackChat.sendMessage(prompt);
      const fallbackResponse = await fallbackResult.response;
      text = fallbackResponse.text();
    }

    return new Response(
      JSON.stringify({ text }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error("Error in gemini-chat function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal Server Error" }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
