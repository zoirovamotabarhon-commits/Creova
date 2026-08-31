import { AIMessage, AIOptions, AIResponse } from './AIProvider';
import { supabase } from '../../services/supabase';

export class AIClient {
  private static instance: AIClient;

  private constructor() {}

  public static getInstance(): AIClient {
    if (!AIClient.instance) {
      AIClient.instance = new AIClient();
    }
    return AIClient.instance;
  }

  /**
   * Executes a chat completion call via Supabase Edge Function without breaking existing services.
   */
  public async chat(
    messages: AIMessage[],
    options: AIOptions = {}
  ): Promise<AIResponse> {
    try {
      const { data, error } = await supabase.functions.invoke('openai-chat', {
        body: {
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2000,
        },
      });

      if (error) {
        throw new Error(`AIClient Request Failed: ${error.message}`);
      }

      return {
        content: data?.choices?.[0]?.message?.content || data?.content || '',
        model: data?.model || 'gpt-4o',
        usage: data?.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err: any) {
      console.error('AIClient Error:', err);
      throw err;
    }
  }
}
