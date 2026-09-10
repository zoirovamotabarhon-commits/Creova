import { supabase } from '../../services/supabase';
import { AI_MODELS } from '../../constants/ai';

export type AIGenerationType =
  | 'chat'
  | 'code'
  | 'vision';

export interface AIGenerateInput {
  type: AIGenerationType;
  prompt: string;
  generationId: string;
  imageUrl?: string;
}

export class AIClient {
  async generate(input: AIGenerateInput) {
    if (!input.generationId) {
      throw new Error('generationId is required');
    }

    if (!input.prompt.trim()) {
      throw new Error('Prompt is required');
    }

    const { data, error } = await supabase.functions.invoke(
      'openai-chat',
      {
        body: {
          type: input.type,
          prompt: input.prompt,
          generationId: input.generationId,
          imageUrl: input.imageUrl,
          model:
            input.type === 'vision'
              ? AI_MODELS.vision
              : AI_MODELS.chat,
        },
      },
    );

    if (error) {
      throw error;
    }

    return data;
  }
}
