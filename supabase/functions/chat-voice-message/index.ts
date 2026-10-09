import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, error: "Method not allowed." },
      405,
    );
  }

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return jsonResponse(
      { success: false, error: "Authentication required." },
      401,
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse(
      {
        success: false,
        error: "Supabase server configuration is missing.",
      },
      500,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const { data: authData, error: authError } =
      await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or expired authentication token.",
        },
        401,
      );
    }

    const body = (await request.json()) as {
      conversationId?: string;
      filePath?: string;
      durationMs?: number;
    };

    const conversationId = body.conversationId?.trim();
    const filePath = body.filePath?.trim();

    const durationMs = Math.max(
      0,
      Math.min(
        600000,
        Math.round(Number(body.durationMs ?? 0)),
      ),
    );

    if (!conversationId || !filePath) {
      return jsonResponse(
        {
          success: false,
          error: "Conversation and file path are required.",
        },
        400,
      );
    }

    const expectedPrefix =
      `${authData.user.id}/${conversationId}/`;

    if (!filePath.startsWith(expectedPrefix)) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid voice file path.",
        },
        403,
      );
    }

    const {
      data: conversation,
      error: conversationError,
    } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (conversationError || !conversation) {
      return jsonResponse(
        {
          success: false,
          error: "Conversation not found.",
        },
        404,
      );
    }

    const { data: inserted, error: insertError } =
      await admin
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          user_id: authData.user.id,
          role: "user",
          content: "Voice message",
          message_type: "voice",
          audio_url: filePath,
          audio_duration_ms: durationMs,
        })
        .select(
          "id,conversation_id,user_id,generation_id,role,content,message_type,audio_url,audio_duration_ms,created_at",
        )
        .single();

    if (insertError || !inserted) {
      return jsonResponse(
        {
          success: false,
          error:
            insertError?.message ??
            "Unable to save voice message.",
        },
        500,
      );
    }

    await admin
      .from("chat_conversations")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", authData.user.id);

    return jsonResponse(inserted);
  } catch (error) {
    console.error("chat-voice-message error:", error);

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to save voice message.",
      },
      500,
    );
  }
});
