export type AIProviderName = 'openai';

export interface AIProviderConfig {
  name: AIProviderName;
  model: string;
}

export const AI_PROVIDERS: Record<AIProviderName, AIProviderConfig> = {
  openai: {
    name: 'openai',
    model: 'gpt-4o-mini',
  },
};
