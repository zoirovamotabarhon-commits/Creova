import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";

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

interface GenerationRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
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

interface GeminiResult {
  text: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

const GEMINI_API_KEY =
  Deno.env.get("GEMINI_API_KEY") ?? "";

const GEMINI_PRIMARY_MODEL =
  Deno.env.get("GEMINI_CHAT_MODEL") ??
  "gemini-3.5-flash";

const GEMINI_FALLBACK_MODEL =
  Deno.env.get("GEMINI_CHAT_FALLBACK_MODEL") ??
  "gemini-3.8-flash";

const GEMINI_VISION_MODEL =
  Deno.env.get("GEMINI_VISION_MODEL") ??
  "gemini-3.5-flash";

const GEMINI_VISION_FALLBACK_MODEL =
  Deno.env.get("GEMINI_VISION_FALLBACK_MODEL") ??
  "gemini-3.8-flash";

const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 12_000;
const MAX_IMAGE_URL_LENGTH = 12_000_000;
const RETRY_DELAYS_MS = [800, 1600];

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

function normalizeMessages(
  messages: AIMessage[],
): AIMessage[] {
  return messages
    .filter(
      (message) =>
        message &&
        (
          message.role === "user" ||
          message.role === "assistant" ||
          message.role === "system"
        ) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content
        .trim()
        .slice(0, MAX_CONTENT_LENGTH),
    }));
}

function isRetryableGeminiError(
  error: unknown,
): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("429") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("resource_exhausted") ||
    message.includes("resource exhausted") ||
    message.includes("rate limit") ||
    message.includes("rate_limit") ||
    message.includes("overloaded") ||
    message.includes("overload") ||
    message.includes("temporarily unavailable") ||
    message.includes("temporary unavailable") ||
    message.includes("high demand") ||
    message.includes("service unavailable") ||
    message.includes("deadline exceeded") ||
    message.includes("fetch failed")
  );
}

function getMaxOutputTokens(
  generationType: GenerationType,
  requested?: number,
): number {
  const defaultValue =
    generationType === "code" ? 8000 : 4000;

  const value =
    typeof requested === "number" &&
    Number.isFinite(requested)
      ? requested
      : defaultValue;

  return Math.max(256, Math.min(value, 32000));
}

function toGeminiContents(
  messages: AIMessage[],
  imageUrl?: string,
): GeminiContent[] {
  const contents: GeminiContent[] = [];

  for (const message of messages) {
    const role =
      message.role === "assistant" ? "model" : "user";

    contents.push({
      role,
      parts: [{ text: message.content }],
    });
  }

  if (imageUrl) {
    const last = contents[contents.length - 1];

    if (!last || last.role !== "user") {
      throw new Error(
        "A final user message is required with an image.",
      );
    }

    const trimmed = imageUrl.trim();

    if (trimmed.startsWith("data:")) {
      const match = trimmed.match(
        /^data:([^;]+);base64,(.+)$/s,
      );

      if (!match) {
        throw new Error("Invalid image data URL.");
      }

      last.parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    } else {
      last.parts.push({
        text: `\n\nImage URL:\n${trimmed}`,
      });
    }
  }

  return contents;
}

function extractGeminiText(
  response: GeminiResponse,
): string {
  return (
    response.candidates
      ?.flatMap(
        (candidate) =>
          candidate.content?.parts ?? [],
      )
      .map((part) =>
        typeof part.text === "string" ? part.text : "",
      )
      .join("")
      .trim() ?? ""
  );
}

async function callGeminiOnce(
  model: string,
  contents: GeminiContent[],
  maxOutputTokens: number,
): Promise<GeminiResult> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

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
    const apiMessage =
      data?.error?.message ||
      rawText ||
      `Gemini request failed with status ${response.status}.`;

    throw new Error(
      `Gemini ${model} failed (${response.status}): ${apiMessage}`,
    );
  }

  if (!data) {
    throw new Error(
      `Gemini ${model} returned invalid JSON.`,
    );
  }

  const text = extractGeminiText(data);

  if (!text) {
    const finishReason =
      data.candidates?.[0]?.finishReason;

    throw new Error(
      finishReason
        ? `Gemini ${model} returned no text. Finish reason: ${finishReason}.`
        : `Gemini ${model} returned an empty response.`,
    );
  }

  const usage = data.usageMetadata;

  return {
    text,
    model,
    usage: usage
      ? {
          prompt_tokens: Number(
            usage.promptTokenCount ?? 0,
          ),
          completion_tokens: Number(
            usage.candidatesTokenCount ?? 0,
          ),
          total_tokens: Number(
            usage.totalTokenCount ?? 0,
          ),
        }
      : undefined,
  };
}

async function callGemini(
  generationType: GenerationType,
  contents: GeminiContent[],
  maxOutputTokens: number,
): Promise<GeminiResult> {
  const primaryModel =
    generationType === "vision"
      ? GEMINI_VISION_MODEL
      : GEMINI_PRIMARY_MODEL;

  const fallbackModel =
    generationType === "vision"
      ? GEMINI_VISION_FALLBACK_MODEL
      : GEMINI_FALLBACK_MODEL;

  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt <= RETRY_DELAYS_MS.length;
    attempt++
  ) {
    try {
      return await callGeminiOnce(
        primaryModel,
        contents,
        maxOutputTokens,
      );
    } catch (error) {
      lastError = error;

      if (!isRetryableGeminiError(error)) {
        break;
      }

      if (attempt < RETRY_DELAYS_MS.length) {
        await new Promise<void>((resolve) => {
          setTimeout(
            resolve,
            RETRY_DELAYS_MS[attempt],
          );
        });
      }
    }
  }

  if (fallbackModel !== primaryModel) {
    try {
      return await callGeminiOnce(
        fallbackModel,
        contents,
        maxOutputTokens,
      );
    } catch (fallbackError) {
      lastError = fallbackError;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed.");
}

async function requireUser(
  request: Request,
  supabaseAdmin: SupabaseClient,
) {
  const authorization =
    request.headers.get("Authorization");

  if (!authorization) {
    throw new Error("Missing authorization header.");
  }

  const token = authorization
    .replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) {
    throw new Error("Missing access token.");
  }

  const { data, error } =
    await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(
      "Invalid or expired authentication token.",
    );
  }

  return data.user;
}

async function getGeneration(
  supabaseAdmin: SupabaseClient,
  generationId: string,
  userId: string,
): Promise<GenerationRow> {
  const { data, error } = await supabaseAdmin
    .from("generation_history")
    .select("id, user_id, type, status")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load generation: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error("Generation not found.");
  }

  return data as GenerationRow;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed.",
      },
      405,
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      {
        success: false,
        error: "Supabase server configuration is missing.",
      },
      500,
    );
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse(
      {
        success: false,
        error: "Gemini API key is not configured.",
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

  let generationIdForFailure: string | undefined;
  let userIdForFailure: string | undefined;

  try {
    const body = (await request.json()) as RequestBody;

    const generationId = body.generationId?.trim();
    generationIdForFailure = generationId;

    const generationType =
      body.generationType ?? "chat";

    const messages = Array.isArray(body.messages)
      ? normalizeMessages(body.messages)
      : [];

    if (!generationId) {
      return jsonResponse(
        {
          success: false,
          error: "generationId is required.",
        },
        400,
      );
    }

    if (
      !["chat", "code", "vision"].includes(
        generationType,
      )
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Unsupported generation type.",
        },
        400,
      );
    }

    const conversationId =
      body.conversationId?.trim();

    const user = await requireUser(
      request,
      supabaseAdmin,
    );

    userIdForFailure = user.id;

    if (generationType === "chat" && conversationId) {
      const {
        data: conversation,
        error: conversationError,
      } = await supabaseAdmin
        .from("chat_conversations")
        .select("id, user_id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (conversationError) {
        return jsonResponse(
          {
            success: false,
            error: conversationError.message,
          },
          500,
        );
      }

      if (!conversation) {
        return jsonResponse(
          {
            success: false,
            error: "Conversation not found.",
          },
          404,
        );
      }
    }

    if (messages.length === 0) {
      return jsonResponse(
        {
          success: false,
          error: "At least one message is required.",
        },
        400,
      );
    }

    if (
      generationType === "vision" &&
      !body.imageUrl
    ) {
      return jsonResponse(
        {
          success: false,
          error: "imageUrl is required for vision requests.",
        },
        400,
      );
    }

    if (
      body.imageUrl &&
      body.imageUrl.length > MAX_IMAGE_URL_LENGTH
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Image URL is too large.",
        },
        400,
      );
    }

    const generation = await getGeneration(
      supabaseAdmin,
      generationId,
      user.id,
    );

    if (generation.type !== generationType) {
      return jsonResponse(
        {
          success: false,
          error:
            "Generation type does not match the requested operation.",
        },
        400,
      );
    }

    const userMessage =
      messages[messages.length - 1];

    if (
      generationType === "chat" &&
      conversationId &&
      userMessage?.role === "user"
    ) {
      const { error: userMessageError } =
        await supabaseAdmin
          .from("chat_messages")
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            generation_id: null,
            role: "user",
            content: userMessage.content,
            message_type: "text",
          });

      if (userMessageError) {
        return jsonResponse(
          {
            success: false,
            error: userMessageError.message,
          },
          500,
        );
      }

      const nextTitle =
        userMessage.content.trim().slice(0, 80) ||
        "New chat";

      const { error: titleError } =
        await supabaseAdmin
          .from("chat_conversations")
          .update({
            title: nextTitle,
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId)
          .eq("user_id", user.id);

      if (titleError) {
        console.error(
          "Failed to update conversation title:",
          titleError,
        );
      }
    }

    const { error: processingError } =
      await supabaseAdmin
        .from("generation_history")
        .update({
          status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", generationId)
        .eq("user_id", user.id);

    if (processingError) {
      throw new Error(
        `Unable to update generation status: ${processingError.message}`,
      );
    }

    const contents = toGeminiContents(
      messages,
      generationType === "vision"
        ? body.imageUrl
        : undefined,
    );

    const maxOutputTokens = getMaxOutputTokens(
      generationType,
      body.max_tokens,
    );

    const result = await callGemini(
      generationType,
      contents,
      maxOutputTokens,
    );

    const completedAt = new Date().toISOString();

    const generationUpdate: {
      status: string;
      provider: string;
      model: string;
      result_text: string;
      completed_at: string;
      updated_at: string;
      metadata?: Record<string, unknown>;
    } = {
      status: "completed",
      provider: "gemini",
      model: result.model,
      result_text: result.text,
      completed_at: completedAt,
      updated_at: completedAt,
    };

    if (result.usage) {
      generationUpdate.metadata = {
        usage: result.usage,
      };
    }

    const { error: completionError } =
      await supabaseAdmin
        .from("generation_history")
        .update(generationUpdate)
        .eq("id", generationId)
        .eq("user_id", user.id);

    if (completionError) {
      throw new Error(
        `Unable to save generation result: ${completionError.message}`,
      );
    }

    if (
      generationType === "chat" &&
      conversationId
    ) {
      const { error: assistantMessageError } =
        await supabaseAdmin
          .from("chat_messages")
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            generation_id: generationId,
            role: "assistant",
            content: result.text,
            message_type: "text",
          });

      if (assistantMessageError) {
        console.error(
          "Failed to save assistant chat message:",
          assistantMessageError,
        );
      }

      const { error: conversationUpdateError } =
        await supabaseAdmin
          .from("chat_conversations")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId)
          .eq("user_id", user.id);

      if (conversationUpdateError) {
        console.error(
          "Failed to update conversation timestamp:",
          conversationUpdateError,
        );
      }
    }

    return jsonResponse({
      success: true,
      text: result.text,
      content: result.text,
      model: result.model,
      generationId,
      conversationId,
      usage: result.usage,
    });
  } catch (error) {
    console.error("gemini-chat error:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Gemini request failed.";

    if (generationIdForFailure && userIdForFailure) {
      const { error: failureUpdateError } =
        await supabaseAdmin
          .from("generation_history")
          .update({
            status: "failed",
            error_message: errorMessage.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", generationIdForFailure)
          .eq("user_id", userIdForFailure);

      if (failureUpdateError) {
        console.error(
          "Failed to save generation error:",
          failureUpdateError,
        );
      }
    }

    return jsonResponse(
      {
        success: false,
        error: errorMessage,
      },
      500,
    );
  }
});
