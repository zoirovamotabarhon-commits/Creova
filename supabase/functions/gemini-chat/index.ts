import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendWithFallback(
  genAI: GoogleGenerativeAI,
  history: any[],
  parts: any[],
): Promise<string> {
  const errors: string[] = [];

  for (const name of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        const chat = model.startChat({
          history,
          generationConfig: { maxOutputTokens: 2048 },
        });
        const result = await chat.sendMessage(parts);
        return result.response.text();
      } catch (e: any) {
        const status = e?.status;
        const msg = String(e?.message ?? e).slice(0, 160);
        errors.push(`${name} [${status ?? "?"}]: ${msg}`);
        console.warn(`Model ${name} attempt ${attempt + 1} failed:`, status, msg);

        // Band yoki limit bo'lsa qayta urinamiz, boshqa xatoda keyingi modelga o'tamiz
        if (status === 503 || status === 429) {
          await sleep(700 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`All models failed. ${errors.join(" | ")}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = body?.prompt || body?.message || body?.text || "";
    const history = body?.history || [];
    const audioBase64: string = body?.audioBase64 || "";
    const audioMimeType: string = body?.audioMimeType || "audio/mp4";

    if (!prompt && !audioBase64) {
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

    // Joriy xabar: matn va (agar bo'lsa) ovoz
    const userParts: any[] = [];
    if (prompt) userParts.push({ text: prompt });
    if (audioBase64) {
      userParts.push({
        inlineData: {
          data: audioBase64.replace(/^data:[^;]+;base64,/, ""),
          mimeType: audioMimeType,
        },
      });
    }

    const text = await sendWithFallback(genAI, chatHistory, userParts);

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
