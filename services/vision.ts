import { supabase } from './supabase';

export interface VisionInput {
  generationId: string;
  prompt: string;
  imageUrl: string;
}

export async function analyzeImage(input: VisionInput) {
  if (!input.generationId) {
    throw new Error('generationId is required');
  }

  if (!input.imageUrl) {
    throw new Error('Image URL is required');
  }

  if (!input.prompt.trim()) {
    throw new Error('Prompt is required');
  }

  const { data, error } = await supabase.functions.invoke(
    'openai-chat',
    {
      body: {
        type: 'vision',
        generationId: input.generationId,
        prompt: input.prompt.trim(),
        imageUrl: input.imageUrl,
      },
    },
  );

  if (error) {
    throw error;
  }

  return data;
}
