import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ChatRole = "user" | "assistant" | "system";
type GenerationType = "chat" | "code" | "vision";

interface AIMessage {
  role: ChatRole;
  content: string;
}

interface RequestBody {
  generationId?: string;
  generationType?: GenerationType;
  conversationId?: string;
  messages?: AIMessage[];
  max_tokens?: number;
  imageUrl?: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

// Asosiy va zaxira Gemini modellari.
const GEMINI_PRIMARY_MODEL = "gemini-3.1-pro-preview";
const GEMINI_FALLBACK_MODEL = "gemini-3.8-flash";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Gemini request failed.";
}

async function callGemini(
  model: string,
  messages: AIMessage[],
  maxTokens: number,
): Promise<{
  text: string;
  model: string;
  usage?: GeminiResponse["usageMetadata"];
}> {
  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  const contents = messages
    .filter(
      (message) =>
        (message.role === "user" ||
          message.role === "assistant") &&
        message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content.trim() }],
    }));

  if (contents.length === 0) {
    throw new Error("Yuborish uchun xabar topilmadi.");
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    },
  };

  if (systemMessages.length > 0) {
    payload.systemInstruction = {
      parts: [{ text: systemMessages.join("\n\n") }],
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify(payload),
    },
  );

  const responseBody = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    const message =
      responseBody.error?.message ??
      `Gemini API xatosi: HTTP ${response.status}`;

    throw new Error(message);
  }

  const text = (responseBody.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error(
      "Gemini javob qaytarmadi. Savolni qayta yuboring.",
    );
  }

  return {
    text,
    model,
    usage: responseBody.usageMetadata,
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Faqat POST so'rovi qabul qilinadi.",
      },
      405,
    );
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    return jsonResponse(
      {
        success: false,
        error: "Tizimga kirish talab qilinadi.",
      },
      401,
    );
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !GEMINI_API_KEY
  ) {
    console.error("Server configuration is incomplete.");

    return jsonResponse(
      {
        success: false,
        error:
          "Server sozlamalari to'liq emas. Supabase Secrets bo'limini tekshiring.",
      },
      500,
    );
  }

  const supabaseAdmin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  let generationId: string | undefined;
  let conversationId: string | undefined;
  let userId: string | undefined;
  let generationType: GenerationType = "chat";

  try {
    // 1. Foydalanuvchini tekshirish.
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse(
        {
          success: false,
          error: "Sessiya yaroqsiz yoki muddati tugagan.",
        },
        401,
      );
    }

    userId = authData.user.id;

    // 2. So'rovni tekshirish.
    let body: RequestBody;

    try {
      body = (await request.json()) as RequestBody;
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "So'rov ma'lumotlari noto'g'ri.",
        },
        400,
      );
    }

    generationId = body.generationId?.trim() || undefined;
    conversationId = body.conversationId?.trim() || undefined;

    generationType =
      body.generationType === "code" ||
      body.generationType === "vision"
        ? body.generationType
        : "chat";

    if (!generationId) {
      return jsonResponse(
        {
          success: false,
          error: "Generation ID ko'rsatilmagan.",
        },
        400,
      );
    }

    if (
      !Array.isArray(body.messages) ||
      body.messages.length === 0
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Xabarlar ro'yxati bo'sh.",
        },
        400,
      );
    }

    const messages = body.messages
      .filter(
        (message): message is AIMessage =>
          !!message &&
          ["user", "assistant", "system"].includes(message.role) &&
          typeof message.content === "string" &&
          message.content.trim().length > 0,
      )
      .slice(-40);

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) {
      return jsonResponse(
        {
          success: false,
          error: "Foydalanuvchi savoli topilmadi.",
        },
        400,
      );
    }

    // 3. Generation yozuvi shu foydalanuvchiga tegishli ekanini tekshirish.
    const { data: generation, error: generationError } =
      await supabaseAdmin
        .from("generation_history")
        .select("id,user_id,type,status")
        .eq("id", generationId)
        .eq("user_id", userId)
        .maybeSingle();

    if (generationError) {
      console.error("Generation lookup failed:", generationError);

      return jsonResponse(
        {
          success: false,
          error: "Generation yozuvini tekshirishda xatolik yuz berdi.",
        },
        500,
      );
    }

    if (!generation) {
      return jsonResponse(
        {
          success: false,
          error: "Generation topilmadi yoki ruxsat yo'q.",
        },
        404,
      );
    }

    // 4. Suhbat foydalanuvchiga tegishli ekanini tekshirish.
    if (generationType === "chat" && conversationId) {
      const { data: conversation, error: conversationError } =
        await supabaseAdmin
          .from("chat_conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("user_id", userId)
          .maybeSingle();

      if (conversationError) {
        console.error(
          "Conversation lookup failed:",
          conversationError,
        );

        return jsonResponse(
          {
            success: false,
            error: "Suhbatni tekshirishda xatolik yuz berdi.",
          },
          500,
        );
      }

      if (!conversation) {
        return jsonResponse(
          {
            success: false,
            error: "Suhbat topilmadi yoki ruxsat yo'q.",
          },
          404,
        );
      }
    }

    // 5. Foydalanuvchi savolini AI chaqirilishidan oldin saqlash.
    // chat_messages jadvaliga mavjud bo'lmagan generation_id yozilmaydi.
    if (generationType === "chat" && conversationId) {
      const { error: saveUserError } = await supabaseAdmin
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: "user",
          content: lastUserMessage.content.trim(),
          message_type: "text",
        });

      if (saveUserError) {
        console.error(
          "Failed to save user message:",
          saveUserError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Savol chat tarixiga saqlanmadi. Ma'lumotlar bazasi sozlamalarini tekshiring.",
          },
          500,
        );
      }

      await supabaseAdmin
        .from("chat_conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("user_id", userId);
    }

    // 6. Gemini modeliga so'rov yuborish.
    const maxTokens = Math.max(
      256,
      Math.min(8192, Math.round(body.max_tokens ?? 4096)),
    );

    let result: {
      text: string;
      model: string;
      usage?: GeminiResponse["usageMetadata"];
    };

    try {
      result = await callGemini(
        GEMINI_PRIMARY_MODEL,
        messages,
        maxTokens,
      );
    } catch (primaryError) {
      console.error(
        `Primary model ${GEMINI_PRIMARY_MODEL} failed:`,
        getErrorMessage(primaryError),
      );

      try {
        result = await callGemini(
          GEMINI_FALLBACK_MODEL,
          messages,
          maxTokens,
        );
      } catch (fallbackError) {
        console.error(
          `Fallback model ${GEMINI_FALLBACK_MODEL} failed:`,
          getErrorMessage(fallbackError),
        );

        throw new Error(
          `Asosiy va zaxira Gemini modellari ishlamadi. ` +
            `Asosiy model: ${getErrorMessage(primaryError)}. ` +
            `Zaxira model: ${getErrorMessage(fallbackError)}`,
        );
      }
    }

    // 7. Generation tarixini yangilash.
    const { error: historyError } = await supabaseAdmin
      .from("generation_history")
      .update({
        status: "completed",
        provider: "gemini",
        model: result.model,
        result_text: result.text,
        error_message: null,
        metadata: {
          usage: result.usage ?? null,
          conversationId: conversationId ?? null,
          generationType,
        },
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId)
      .eq("user_id", userId);

    if (historyError) {
      console.error(
        "Failed to update generation history:",
        historyError,
      );
    }

    // 8. Gemini javobini chat tarixiga saqlash.
    if (generationType === "chat" && conversationId) {
      const { error: assistantMessageError } =
        await supabaseAdmin
          .from("chat_messages")
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "assistant",
            content: result.text,
            message_type: "text",
          });

      if (assistantMessageError) {
        console.error(
          "Failed to save assistant message:",
          assistantMessageError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "Gemini javob berdi, lekin javob chat tarixiga saqlanmadi. Chat jadvali va RLS sozlamalarini tekshiring.",
            generationId,
            conversationId,
            text: result.text,
            model: result.model,
          },
          500,
        );
      }

      await supabaseAdmin
        .from("chat_conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("user_id", userId);
    }

    // 9. Muvaffaqiyatli javob.
    return jsonResponse({
      success: true,
      text: result.text,
      content: result.text,
      message: result.text,
      model: result.model,
      generationId,
      conversationId,
      usage: result.usage ?? null,
    });
  } catch (error) {
    const message = getErrorMessage(error);

    console.error("gemini-chat error:", message);

    // Xato yuz bersa, generation tarixiga xatoni yozish.
    if (generationId && userId) {
      const { error: updateError } = await supabaseAdmin
        .from("generation_history")
        .update({
          status: "failed",
          provider: "gemini",
          error_message: message.slice(0, 4000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", generationId)
        .eq("user_id", userId);

      if (updateError) {
        console.error(
          "Failed to record generation error:",
          updateError,
        );
      }
    }

    return jsonResponse(
      {
        success: false,
        error: message,
        generationId,
        conversationId,
      },
      500,
    );
  }
});
