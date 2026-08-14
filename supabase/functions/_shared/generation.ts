import {
  createClient,
} from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY",
  ) ??
  Deno.env.get(
    "SUPABASE_SECRET_KEY",
  ) ??
  "";

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

interface UpdateGenerationParams {
  generationId: string;
  userId: string;
  status: GenerationStatus;
  provider?: string;
  model?: string;
  resultUrl?: string;
  resultText?: string;
  errorMessage?: string;
}

function getAdminClient() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error(
      "Supabase server configuration is missing.",
    );
  }

  return createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function updateGeneration(
  params: UpdateGenerationParams,
) {
  const {
    generationId,
    userId,
    status,
    provider,
    model,
    resultUrl,
    resultText,
    errorMessage,
  } = params;

  if (!generationId.trim()) {
    throw new Error(
      "Generation ID is required.",
    );
  }

  if (!userId.trim()) {
    throw new Error(
      "User ID is required.",
    );
  }

  const supabase =
    getAdminClient();

  const { data: current, error: readError } =
    await supabase
      .from("generation_history")
      .select("*")
      .eq("id", generationId)
      .eq("user_id", userId)
      .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!current) {
    throw new Error(
      "Generation record not found.",
    );
  }

  const update: Record<
    string,
    unknown
  > = {
    status,
    updated_at:
      new Date().toISOString(),
  };

  if (
    status === "processing" &&
    !current.started_at
  ) {
    update.started_at =
      new Date().toISOString();
  }

  if (
    (
      status === "completed" ||
      status === "failed" ||
      status === "cancelled"
    ) &&
    !current.completed_at
  ) {
    update.completed_at =
      new Date().toISOString();
  }

  if (provider !== undefined) {
    update.provider =
      provider;
  }

  if (model !== undefined) {
    update.model =
      model;
  }

  if (resultUrl !== undefined) {
    update.result_url =
      resultUrl;
  }

  if (resultText !== undefined) {
    update.result_text =
      resultText;
  }

  if (
    errorMessage !== undefined
  ) {
    update.error_message =
      errorMessage;
  }

  const { data, error } =
    await supabase
      .from("generation_history")
      .update(update)
      .eq("id", generationId)
      .eq("user_id", userId)
      .select()
      .single();

  if (error) {
    throw error;
  }

  return data;
        }
