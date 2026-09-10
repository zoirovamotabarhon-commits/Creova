import { AIClient } from '../../ai/AIClient';
import type { AgentContext } from '../AgentContext';

export class VisionAgent {
  private readonly client = new AIClient();

  async execute(context: AgentContext) {
    if (!context.userId) {
      throw new Error('Authentication required');
    }

    if (!context.generationId) {
      throw new Error('generationId is required');
    }

    if (!context.imageUrl) {
      throw new Error('Image URL is required');
    }

    if (!context.input?.trim()) {
      throw new Error('Vision prompt is required');
    }

    return this.client.generate({
      type: 'vision',
      prompt: context.input.trim(),
      generationId: context.generationId,
      imageUrl: context.imageUrl,
    });
  }
}
