import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const MUSIC_MODEL =
  Deno.env.get("GEMINI_MUSIC_MODEL") ?? "lyria-3.5";
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

// ---- inlined from _shared/generation.ts (standalone - no cross-function import) ----

type SharedGenerationType =
  | "chat" | "code" | "image" | "video" | "music" | "voice" | "vision";

type SharedGenerationStatus =
  | "queued" | "processing" | "completed" | "failed" | "cancelled";

async function sharedGetGeneration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  generationId: string,
  expectedType?: SharedGenerationType,
) {
  const { data, error } = await supabase
    .from("generation_history")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Generation not found");

  if (expectedType && data.type !== expectedType) {
    throw new Error(
      `Generation type mismatch: expected ${expectedType}, got ${data.type}`,
    );
  }

  return data;
}

function sharedAssertCanStart(generation: { status: string }) {
  if (generation.status !== "queued") {
    throw new Error(
      `Generation cannot start from status "${generation.status}"`,
    );
  }
}

function sharedAssertCanUpdate(generation: { status: string }) {
  if (
    generation.status === "completed" ||
    generation.status === "failed" ||
    generation.status === "cancelled"
  ) {
    throw new Error(`Generation is already terminal: ${generation.status}`);
  }
}

async function getGenerationForUser(
  generationId: string,
  userId: string,
  expectedType?: SharedGenerationType,
) {
  return sharedGetGeneration(
    admin(),
    userId,
    generationId,
    expectedType,
  );
}

async function updateGeneration(input: {
  generationId: string;
  userId: string;
  status: SharedGenerationStatus;
  expectedType?: SharedGenerationType;
  provider?: string;
  model?: string;
  resultText?: string;
  resultUrl?: string;
  errorMessage?: string;
  usage?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const supabase = admin();
  const {
    generationId, userId, status, expectedType,
    provider, model, resultText, resultUrl, errorMessage, usage, metadata,
  } = input;

  const current = await sharedGetGeneration(
    supabase, userId, generationId, expectedType,
  );

  if (status === "processing") {
    sharedAssertCanStart(current);

    const { data, error } = await supabase
      .from("generation_history")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", generationId)
      .eq("user_id", userId)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error("Generation was already claimed or is no longer available");
    }
    return data;
  }

  sharedAssertCanUpdate(current);

  const mergedMetadata = {
    ...((current.metadata as Record<string, unknown>) ?? {}),
    ...(metadata ?? {}),
    ...(usage ? { usage } : {}),
  };

  const update: Record<string, unknown> = {
    status,
    metadata: mergedMetadata,
    updated_at: new Date().toISOString(),
  };

  if (provider !== undefined) update.provider = provider;
  if (model !== undefined) update.model = model;
  if (resultText !== undefined) update.result_text = resultText;
  if (resultUrl !== undefined) update.result_url = resultUrl;
  if (errorMessage !== undefined) update.error_message = errorMessage;

  if (status === "completed" || status === "failed" || status === "cancelled") {
    update.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("generation_history")
    .update(update)
    .eq("id", generationId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Generation not found while updating.");

  return data;
}

async function storeAssetAndGetSignedUrl(input: {
  bucket: string;
  path: string;
  data: Uint8Array | ArrayBuffer;
  contentType: string;
  expiresIn?: number;
}) {
  const supabase = admin();
  const { bucket, path, data, contentType, expiresIn = 60 * 60 } = input;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, data, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`Asset upload failed: ${uploadError.message}`);
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (signError || !signed?.signedUrl) {
    throw new Error(
      signError?.message ?? "Unable to create a signed URL for the asset.",
    );
  }

  return { url: signed.signedUrl, path };
}

// ---- end inlined ----

async function user(req: Request) {
  const h = req.headers.get("Authorization");

  if (!h?.startsWith("Bearer ")) {
    return null;
  }

  const { data } = await admin().auth.getUser(h.slice(7).trim());

  return data.user ?? null;
}

function extractAudioBase64(
  result: unknown,
): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const candidates = (result as { candidates?: unknown }).candidates;

  if (!Array.isArray(candidates)) {
    return null;
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    const content = (candidate as { content?: unknown }).content;
    if (!content || typeof content !== "object") continue;

    const parts = (content as { parts?: unknown }).parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (!part || typeof part !== "object") continue;

      const inlineData = (part as { inlineData?: unknown }).inlineData;
      if (!inlineData || typeof inlineData !== "object") continue;

      const data = (inlineData as { data?: unknown }).data;

      if (typeof data === "string" && data.length > 0) {
        return data;
      }
    }
  }

  return null;
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
          error: "GEMINI_API_KEY is not configured.",
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

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MUSIC_MODEL)}:generateContent`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": KEY,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
        },
      }),
    });

    const raw = await response.text();

    let result: Record<string, unknown> = {};

    try {
      result = raw ? JSON.parse(raw) : {};
    } catch {
      result = { raw };
    }

    if (!response.ok) {
      const errorObject = result.error;
      const message =
        errorObject && typeof errorObject === "object"
          ? (errorObject as { message?: unknown }).message
          : undefined;

      throw new Error(
        typeof message === "string"
          ? message
          : `Gemini music generation failed (${response.status}).`,
      );
    }

    const base64 = extractAudioBase64(result);

    if (!base64) {
      throw new Error("Gemini did not return music audio data.");
    }

    const buffer = Uint8Array.from(
      atob(base64),
      (character) => character.charCodeAt(0),
    );

    if (!buffer.byteLength) {
      throw new Error("Generated music is empty.");
    }

    await ensureBucket();

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
      provider: "gemini",
      model: MUSIC_MODEL,
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
