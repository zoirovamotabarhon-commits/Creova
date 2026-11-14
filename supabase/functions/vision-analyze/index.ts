import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// CREOVA AI: describes / answers questions about one image.
// POST JSON { prompt?, imageBase64? | imageUri?, mimeType? }  ->  { success, text, description }
//
// The app sends the picture as base64 (a local file:// path cannot be read by the server).
// Every Gemini call has its own time limit and the request has a budget below the 60 s
// the app waits.

const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash"];
const ATTEMPT_TIMEOUT_MS = 20_000;
const TOTAL_BUDGET_MS = 50_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function buildImagePart(imageBase64?: string, mimeType?: string, imageUri?: string) {
  if (imageBase64) {
    const data = imageBase64.replace(/^data:[^;]+;base64,/, "");
    if (data.length > MAX_BASE64_CHARS) throw new HttpError(413, "The image is too large.");
    return { inlineData: { data, mimeType: mimeType || "image/jpeg" } };
  }
  if (imageUri && /^https?:\/\//i.test(imageUri)) {
    const response = await fetch(imageUri, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new HttpError(400, `Could not download the image (${response.status}).`);
    const declared = Number(response.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
      throw new HttpError(413, "The image is too large.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "The image is too large.");
    return {
      inlineData: {
        data: bytesToBase64(bytes),
        mimeType: response.headers.get("content-type")?.split(";")[0] || "image/jpeg",
      },
    };
  }
  throw new HttpError(400, "No image was sent: the server cannot read a file:// path, send base64.");
}

// A call that hangs is abandoned after `ms`, whatever the SDK does with its own timeout.
function raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Request timed out after ${ms} ms`), { name: "AbortError" }));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// deno-lint-ignore no-explicit-any
async function generateWithRetry(genAI: GoogleGenerativeAI, parts: any[]): Promise<string> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const errors: string[] = [];
  const statuses: number[] = [];

  outer: for (const name of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 2000) {
        errors.push("time budget used up");
        break outer;
      }
      try {
        const timeout = Math.min(ATTEMPT_TIMEOUT_MS, remaining - 500);
        const model = genAI.getGenerativeModel({ model: name }, { timeout });
        const result = await raceTimeout(model.generateContent(parts), timeout);
        const text = result.response.text();
        if (!text || !text.trim()) {
          errors.push(`${name}: empty answer`);
          break;
        }
        return text;
      } catch (e: unknown) {
        const err = e as { status?: number; name?: string; message?: string };
        const status = typeof err?.status === "number" ? err.status : 0;
        statuses.push(status);
        const timedOut = err?.name === "AbortError" || /abort|timed? ?out/i.test(String(err?.message ?? ""));
        errors.push(`${name} [${status || (timedOut ? "timeout" : "?")}]: ${String(err?.message ?? e).slice(0, 160)}`);
        if (status === 503 || status === 429) {
          await new Promise((r) => setTimeout(r, Math.min(800 * (attempt + 1), Math.max(0, (deadline - Date.now()) / 4))));
          continue;
        }
        break; // slow, rejected or broken: next model
      }
    }
  }

  const rateLimited = statuses.length > 0 && statuses.every((s) => s === 429);
  throw new HttpError(rateLimited ? 429 : 503, `All models failed. ${errors.join(" | ")}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new HttpError(401, "Missing Authorization header");

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const imageUri = typeof body?.imageUri === "string" ? body.imageUri : undefined;
    const imageBase64 = typeof body?.imageBase64 === "string" ? body.imageBase64 : undefined;
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : undefined;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new HttpError(500, "GEMINI_API_KEY environment variable is not configured.");
    if (!imageUri && !imageBase64) throw new HttpError(400, "Image is required for vision analysis.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const imagePart = await buildImagePart(imageBase64, mimeType, imageUri);
    const userPrompt = prompt || "Describe this image in detail.";

    const description = await generateWithRetry(genAI, [userPrompt, imagePart]);

    return json({ success: true, text: description, description });
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status >= 500) console.error("vision-analyze failed:", error.status, error.message);
      return json({ success: false, error: error.message }, error.status);
    }
    console.error("vision-analyze error:", error);
    return json(
      { success: false, error: error instanceof Error ? error.message : "Vision analysis failed" },
      500,
    );
  }
});
