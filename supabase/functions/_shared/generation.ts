import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type GenerationType =
  | 'chat'
  | 'code'
  | 'image'
  | 'video'
  | 'music'
  | 'voice'
  | 'vision';

export type GenerationStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Generation {
  id: string;
  user_id: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string | null;
  result_text: string | null;
  result_url: string | null;
  provider: string | null;
  model: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export async function getGeneration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  generationId: string,
  expectedType?: GenerationType,
) {
  const { data, error } = await supabase
    .from('generation_history')
    .select('*')
    .eq('id', generationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Generation not found');
  }

  if (
    expectedType &&
    data.type !== expectedType
  ) {
    throw new Error(
      `Generation type mismatch: expected ${expectedType}, got ${data.type}`,
    );
  }

  return data as Generation;
}

export function assertCanStartGeneration(
  generation: Generation,
) {
  if (generation.status !== 'queued') {
    throw new Error(
      `Generation cannot start from status "${generation.status}"`,
    );
  }
}

export function assertCanUpdateGeneration(
  generation: Generation,
) {
  if (
    generation.status === 'completed' ||
    generation.status === 'failed' ||
    generation.status === 'cancelled'
  ) {
    throw new Error(
      `Generation is already terminal: ${generation.status}`,
    );
  }
}

export async function claimGeneration(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  generationId: string,
  expectedType: GenerationType,
) {
  const generation = await getGeneration(
    supabase,
    userId,
    generationId,
    expectedType,
  );

  assertCanStartGeneration(generation);

  const { data, error } = await supabase
    .from('generation_history')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
    })
    .eq('id', generationId)
    .eq('user_id', userId)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Generation was already claimed or is no longer available',
    );
  }

  return data as Generation;
}

/* ------------------------------------------------------------------ */
/* Shared admin client                                                 */
/* ------------------------------------------------------------------ */

let adminClient:
  | ReturnType<typeof createClient>
  | null = null;

function getAdminClient(): ReturnType<typeof createClient> {
  if (adminClient) {
    return adminClient;
  }

  const url =
    Deno.env.get('SUPABASE_URL') ?? '';

  const key =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SECRET_KEY') ??
    '';

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY environment variables.',
    );
  }

  adminClient = createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return adminClient;
}

/**
 * Loads a generation and verifies that it belongs to
 * the requested user and optionally matches the expected
 * generation type.
 */
export async function getGenerationForUser(
  generationId: string,
  userId: string,
  expectedType?: GenerationType,
): Promise<Generation> {
  const supabase =
    getAdminClient();

  return getGeneration(
    supabase,
    userId,
    generationId,
    expectedType,
  );
}

export interface UpdateGenerationInput {
  generationId: string;
  userId: string;
  status: GenerationStatus;
  expectedType?: GenerationType;
  provider?: string;
  model?: string;
  resultText?: string;
  resultUrl?: string;
  errorMessage?: string;

  /**
   * Token/usage information returned by the
   * AI provider.
   *
   * Stored under metadata.usage because the
   * generation_history table does not have a
   * dedicated usage column.
   */
  usage?: Record<string, unknown>;

  metadata?: Record<string, unknown>;
}

/**
 * Updates generation state.
 *
 * Processing:
 *   queued -> processing
 *
 * Terminal:
 *   processing -> completed
 *   processing -> failed
 *   processing -> cancelled
 */
export async function updateGeneration(
  input: UpdateGenerationInput,
): Promise<Generation> {
  const supabase =
    getAdminClient();

  const {
    generationId,
    userId,
    status,
    expectedType,
    provider,
    model,
    resultText,
    resultUrl,
    errorMessage,
    usage,
    metadata,
  } = input;

  const current =
    await getGeneration(
      supabase,
      userId,
      generationId,
      expectedType,
    );

  /*
   * Processing is an atomic claim.
   */
  if (status === 'processing') {
    assertCanStartGeneration(
      current,
    );

    const {
      data,
      error,
    } = await supabase
      .from('generation_history')
      .update({
        status: 'processing',
        started_at:
          new Date().toISOString(),
      })
      .eq('id', generationId)
      .eq('user_id', userId)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        'Generation was already claimed or is no longer available',
      );
    }

    return data as Generation;
  }

  /*
   * Completed / failed / cancelled.
   */
  assertCanUpdateGeneration(
    current,
  );

  const mergedMetadata: Record<
    string,
    unknown
  > = {
    ...(
      (current.metadata as Record<
        string,
        unknown
      >) ?? {}
    ),

    ...(metadata ?? {}),

    ...(usage
      ? { usage }
      : {}),
  };

  const update: Record<
    string,
    unknown
  > = {
    status,
    metadata:
      mergedMetadata,
    updated_at:
      new Date().toISOString(),
  };

  if (
    provider !== undefined
  ) {
    update.provider =
      provider;
  }

  if (
    model !== undefined
  ) {
    update.model =
      model;
  }

  if (
    resultText !== undefined
  ) {
    update.result_text =
      resultText;
  }

  if (
    resultUrl !== undefined
  ) {
    update.result_url =
      resultUrl;
  }

  if (
    errorMessage !== undefined
  ) {
    update.error_message =
      errorMessage;
  }

  if (
    status === 'completed' ||
    status === 'failed' ||
    status === 'cancelled'
  ) {
    update.completed_at =
      new Date().toISOString();
  }

  const {
    data,
    error,
  } = await supabase
    .from('generation_history')
    .update(update)
    .eq('id', generationId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error(
      'Generation not found while updating.',
    );
  }

  return data as Generation;
}

export interface StoreAssetInput {
  bucket: string;
  path: string;
  data:
    | Uint8Array
    | ArrayBuffer;
  contentType: string;

  /**
   * Signed URL lifetime in seconds.
   *
   * Default: 1 hour.
   */
  expiresIn?: number;
}

export interface StoredAsset {
  url: string;
  path: string;
}

/**
 * Uploads generated assets to Supabase Storage
 * and returns a signed URL.
 */
export async function storeAssetAndGetSignedUrl(
  input: StoreAssetInput,
): Promise<StoredAsset> {
  const supabase =
    getAdminClient();

  const {
    bucket,
    path,
    data,
    contentType,
    expiresIn = 60 * 60,
  } = input;

  const {
    error: uploadError,
  } = await supabase.storage
    .from(bucket)
    .upload(
      path,
      data,
      {
        contentType,
        upsert: true,
      },
    );

  if (uploadError) {
    throw new Error(
      `Asset upload failed: ${uploadError.message}`,
    );
  }

  const {
    data: signed,
    error: signError,
  } =
    await supabase.storage
      .from(bucket)
      .createSignedUrl(
        path,
        expiresIn,
      );

  if (
    signError ||
    !signed?.signedUrl
  ) {
    throw new Error(
      signError?.message ??
        'Unable to create a signed URL for the asset.',
    );
  }

  return {
    url: signed.signedUrl,
    path,
  };
      }
