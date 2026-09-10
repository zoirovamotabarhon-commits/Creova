import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "npm:openai@6.49.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import {
  getGenerationForUser,
  storeAssetAndGetSignedUrl,
  updateGeneration,
} from "../_shared/generation.ts";

const KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";
const BUCKET = "generation-assets";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (b: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: HEADERS,
  });

function admin() {
  if (!URL || !SERVICE) {
    throw new Error("Supabase server configuration is missing.");
  }

  return createClient(URL, SERVICE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function user(req: Request) {
  const h = req.headers.get("Authorization");

  if (!h?.startsWith("Bearer ")) {
    return null;
  }

  const { data } = await admin().auth.getUser(h.slice(7).trim());

  return data.user ?? null;
}

async function ensureBucket() {
  const a = admin();

  const { data, error } = await a.storage.listBuckets();

  if (error) {
    throw error;
  }

  if (!data?.some((b) => b.name === BUCKET)) {
    const { error: e } = await a.storage.createBucket(BUCKET, {
      public: false,
    });

    if (
      e &&
      !e.message.toLowerCase().includes("already exists")
    ) {
      throw e;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: HEADERS,
    });
  }

  if (req.method !== "POST") {
    return json(
      {
        success: false,
        error: "Method not allowed.",
      },
      405,
    );
  }

  let generationId = "";
  let userId = "";

  try {
    if (!KEY) {
      return json(
        {
          success: false,
          error: "OPENAI_API_KEY is not configured.",
        },
        500,
      );
    }

    const u = await user(req);

    if (!u) {
      return json(
        {
          success: false,
          error: "Authentication required.",
        },
        401,
      );
    }

    userId = u.id;

    const b = await req.json();

    generationId =
      typeof b.generationId === "string"
        ? b.generationId.trim()
        : "";

    const text =
      typeof b.text === "string"
        ? b.text.trim()
        : "";

    if (!generationId || !text) {
      return json(
        {
          success: false,
          error: !generationId
            ? "Generation ID is required."
            : "Text is required.",
        },
        400,
      );
    }

    await getGenerationForUser(
      generationId,
      userId,
      "voice",
    );

    await updateGeneration({
      generationId,
      userId,
      expectedType: "voice",
      status: "processing",
    });

    const speech = await new OpenAI({
      apiKey: KEY,
    }).audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
      response_format: "mp3",
    });

    const buffer = await speech.arrayBuffer();

    if (!buffer.byteLength) {
      throw new Error(
        "Audio generation returned empty data.",
      );
    }

    await ensureBucket();

    const stored = await storeAssetAndGetSignedUrl({
      bucket: BUCKET,
      path: `${userId}/${generationId}.mp3`,
      body: buffer,
      contentType: "audio/mpeg",
    });

    await updateGeneration({
      generationId,
      userId,
      expectedType: "voice",
      status: "completed",
      provider: "openai",
      model: "tts-1",
      resultUrl: stored.url,
      metadata: {
        storageBucket: BUCKET,
        storagePath: stored.path,
      },
    });

    return json({
      success: true,
      generationId,
      audioUrl: stored.url,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Voice generation failed.";

    if (generationId && userId) {
      try {
        await updateGeneration({
          generationId,
          userId,
          expectedType: "voice",
          status: "failed",
          errorMessage: message,
        });
      } catch (e) {
        console.error(e);
      }
    }

    return json(
      {
        success: false,
        generationId: generationId || undefined,
        error: message,
      },
      500,
    );
  }
});
