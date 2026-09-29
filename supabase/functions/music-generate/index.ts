import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import {
  getGenerationForUser,
  storeAssetAndGetSignedUrl,
  updateGeneration,
} from "../_shared/generation.ts";

const KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
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
          error: "ELEVENLABS_API_KEY is not configured.",
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

    const prompt =
      typeof b.prompt === "string"
        ? b.prompt.trim()
        : "";

    if (!generationId || !prompt) {
      return json(
        {
          success: false,
          error: !generationId
            ? "Generation ID is required."
            : "Music prompt is required.",
        },
        400,
      );
    }

    await getGenerationForUser(
      generationId,
      userId,
      "music",
    );

    await updateGeneration({
      generationId,
      userId,
      expectedType: "music",
      status: "processing",
    });

    const response = await fetch(
      "https://api.elevenlabs.io/v1/music",
      {
        method: "POST",
        headers: {
          "xi-api-key": KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          prompt,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        (await response.text()) ||
          `ElevenLabs request failed: ${response.status}`,
      );
    }

    const buffer = await response.arrayBuffer();

    if (!buffer.byteLength) {
      throw new Error("Generated music is empty.");
    }

    await ensureBucket();

    // NOTE: storeAssetAndGetSignedUrl() takes a `data` field, not
    // `body` - the previous code passed `body: buffer`, so no
    // actual bytes were ever uploaded.
    const stored = await storeAssetAndGetSignedUrl({
      bucket: BUCKET,
      path: `${userId}/${generationId}.mp3`,
      data: buffer,
      contentType: "audio/mpeg",
    });

    await updateGeneration({
      generationId,
      userId,
      expectedType: "music",
      status: "completed",
      provider: "elevenlabs",
      model: "music_v1",
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
        : "Music generation failed.";

    if (generationId && userId) {
      try {
        await updateGeneration({
          generationId,
          userId,
          expectedType: "music",
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
