import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type GenerationType =
  | 'chat'
  | 'code'
  | 'image'
  | 'video'
  | 'music'
  | 'voice';

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
  result_url: string | null;
  error_message: string | null;
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
