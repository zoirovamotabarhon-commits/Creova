import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

type GenerationType = "chat" | "code" | "vision";
type ChatRole = "user" | "assistant" | "system";

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

interface GenerationRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
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

const PRIMARY_MODEL =
  Deno.env.get("GEMINI_CHAT_MODEL") ?? "gemini-2.5-flash";

const FALLBACK_MODEL =
  Deno.env.get("GEMINI_CHAT_FALLBACK_MODEL") ?? "gemini-2.5-pro";

const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 12_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function normalizeMessages(messages: AIMessage[]): AIMessage[] {
  return messages
    .filter(
      (message) =>
        message &&
        ["user", "assistant", "system"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_CONTENT_LENGTH),
    }));
}

async function requireUser(
  request: Request,
  admin: SupabaseClient,
) {
  const authorization = request.headers.get("Authorization");

  if (!authorization) {
    throw new Error("Authorization header topilmadi.");
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Access token topilmadi.");
  }

  const { data, error } = await admin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Sessiya yaroqsiz yoki muddati tugagan.");
  }

  return data.user;
}

async function getGeneration(
  admin: SupabaseClient,
  generationId: string,
  userId: string,
): Promise<GenerationRow> {
  const { data, error } = await admin
    .from("generation_history")
    .select("id,user_id,type,status")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Generation o'qilmadi: ${error.message}`);
  }

  if (!data) {
    throw new Error("Generation topilmadi.");
  }

  return data as GenerationRow;
}

function toGeminiContents(messages: AIMessage[]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

function extractGeminiText(response: GeminiResponse): string {
  return (
    response.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim() ?? ""
  );
}

async function callGemini(
  model: string,
  messages: AIMessage[],
  maxOutputTokens: number,
): Promise<{
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const contents = toGeminiContents(messages);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        maxOutputTokens,
      },
    }),
  });

  const rawText = await response.text();

  let data: GeminiResponse | null = null;
  try {
    data = JSON.parse(rawText) as GeminiResponse;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      `Gemini ${model} (${response.status}): ${
        data?.error?.message ?? rawText ?? "So'rov bajarilmadi."
      }`,
    );
  }

  if (!data) {
    throw new Error("Gemini noto'g'ri javob formatini qaytardi.");
  }

  const text = extractGeminiText(data);

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(
      reason
        ? `Gemini bo'sh javob qaytardi. Sabab: ${reason}`
        : "Gemini bo'sh javob qaytardi.",
    );
  }

  const usage = data.usageMetadata;

  return {
    text,
    model,
    usage: usage
      ? {
          prompt_tokens: Number(usage.promptTokenCount ?? 0),
          completion_tokens: Number(usage.candidatesTokenCount ?? 0),
          total_tokens: Number(usage.totalTokenCount ?? 0),
        }
      : undefined,
  };
}

async function generateAnswer(
  messages: AIMessage[],
  maxOutputTokens: number,
) {
  try {
    return await callGemini(PRIMARY_MODEL, messages, maxOutputTokens);
  } catch (primaryError) {
    console.error("Gemini primary model xatosi:", primaryError);

    if (FALLBACK_MODEL === PRIMARY_MODEL) {
      throw primaryError;
    }

    // Asosiy model ishlamasa, ikkinchi modelni sinab ko'ramiz.
    return await callGemini(FALLBACK_MODEL, messages, maxOutputTokens);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Faqat POST so'rovi qabul qilinadi." },
      405,
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      { success: false, error: "Supabase server sozlamalari topilmadi." },
      500,
    );
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse(
      { success: false, error: "GEMINI_API_KEY sozlanmagan." },
      500,
    );
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let generationId: string | undefined;
  let userId: string | undefined;

  try {
    const user = await requireUser(request, admin);
    userId = user.id;

    const body = (await request.json()) as RequestBody;

    generationId = body.generationId?.trim();

    const generationType = body.generationType ?? "chat";
    const conversationId = body.conversationId?.trim();

    const messages = Array.isArray(body.messages)
      ? normalizeMessages(body.messages)
      : [];

    if (!generationId) {
      return jsonResponse(
        { success: false, error: "generationId majburiy." },
        400,
      );
    }

    if (!["chat", "code", "vision"].includes(generationType)) {
      return jsonResponse(
        { success: false, error: "Generation turi qo'llab-quvvatlanmaydi." },
        400,
      );
    }

    if (messages.length === 0) {
      return jsonResponse(
        { success: false, error: "Kamida bitta xabar yuboring." },
        400,
      );
    }

    if (generationType === "chat" && !conversationId) {
      return jsonResponse(
        { success: false, error: "Chat ID yuborilmadi." },
        400,
      );
    }

    const generation = await getGeneration(admin, generationId, user.id);

    if (generation.type !== generationType) {
      return jsonResponse(
        {
          success: false,
          error: "Generation turi bazadagi yozuvga mos kelmaydi.",
        },
        400,
      );
    }

    if (generationType === "chat" && conversationId) {
      const { data: conversation, error: conversationError } =
        await admin
          .from("chat_conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("user_id", user.id)
          .maybeSingle();

      if (conversationError) {
        throw new Error(conversationError.message);
      }

      if (!conversation) {
        return jsonResponse(
          { success: false, error: "Chat topilmadi." },
          404,
        );
      }
    }

    // Foydalanuvchi savoli services/chat.ts da oldindan saqlanadi.
    // Bu yerda ikkinchi marta user xabarini INSERT qilmaymiz.

    const { error: processingError } = await admin
      .from("generation_history")
      .update({ status: "processing" })
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (processingError) {
      throw new Error(
        `Generation holati yangilanmadi: ${processingError.message}`,
      );
    }

    const requestedTokens = Number(body.max_tokens ?? 4000);
    const maxOutputTokens = Number.isFinite(requestedTokens)
      ? Math.max(256, Math.min(requestedTokens, 32000))
      : 4000;

    const result = await generateAnswer(messages, maxOutputTokens);

    // Avval Gemini javobini chat_messages ga saqlaymiz.
    if (generationType === "chat" && conversationId) {
      const { error: assistantMessageError } = await admin
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: result.text,
          message_type: "text",
        });

      if (assistantMessageError) {
        throw new Error(
          `AI javobi bazaga saqlanmadi: ${assistantMessageError.message}`,
        );
      }

      const { error: conversationUpdateError } = await admin
        .from("chat_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("user_id", user.id);

      if (conversationUpdateError) {
        console.error(
          "Chat vaqti yangilanmadi:",
          conversationUpdateError.message,
        );
      }
    }

    const { error: completedError } = await admin
      .from("generation_history")
      .update({
        status: "completed",
        provider: "gemini",
        model: result.model,
        result_text: result.text,
        error_message: null,
        completed_at: new Date().toISOString(),
        metadata: {
          provider: "gemini",
          model: result.model,
          ...(result.usage ? { usage: result.usage } : {}),
        },
      })
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (completedError) {
      console.error(
        "Generation tarixi yangilanmadi:",
        completedError.message,
      );
    }

    return jsonResponse({
      success: true,
      message: result.text,
      text: result.text,
      content: result.text,
      model: result.model,
      generationId,
      conversationId,
      usage: result.usage,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Gemini so'rovi bajarilmadi.";

    console.error("gemini-chat error:", errorMessage);

    if (generationId && userId) {
      const { error: updateError } = await admin
        .from("generation_history")
        .update({
          status: "failed",
          error_message: errorMessage.slice(0, 2000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", generationId)
        .eq("user_id", userId);

      if (updateError) {
        console.error("Generation xatosi saqlanmadi:", updateError.message);
      }
    }

    return jsonResponse(
      {
        success: false,
        error: errorMessage,
        generationId,
      },
      500,
    );
  }
});
