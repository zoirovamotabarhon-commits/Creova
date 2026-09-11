import { Agent } from '../Agent';
import type { AgentContext } from '../AgentContext';
import type { AIMessage, AIResponse } from '../../ai/AIProvider';

export class VisionAgent extends Agent {
  readonly id = 'vision-agent';
  readonly name = 'Vision Agent';
  readonly description =
    'Analyzes screenshots, design mockups, and other images referenced by URL.';
  readonly systemPrompt =
    'You are CREOVA AI Vision. Describe and analyze the referenced image as accurately as possible using its URL and the accompanying prompt.';

  async process(
    input: string,
    context: AgentContext,
  ): Promise<AIResponse> {
    if (!context.userId) {
      throw new Error('Authentication required');
    }

    if (!context.imageUrl) {
      throw new Error('Image URL is required');
    }

    const prompt = input.trim();

    if (!prompt) {
      throw new Error('Vision prompt is required');
    }

    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `${prompt}\n\nImage: ${context.imageUrl}`,
      },
    ];

    // NOTE: the openai-chat edge function currently only reads
    // `messages`/text fields — it does not yet accept/forward an image
    // payload to the model. Passing the URL inline keeps this agent
    // type-correct and functional for text-based analysis today; true
    // multimodal image input is a separate backend feature to add later.
    return this.aiClient.chat(messages, {
      generationType: 'chat',
      generationId: context.generationId,
    });
  }
  }
