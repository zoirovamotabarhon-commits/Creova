import { AIClient } from '../../ai/AIClient';
import type { AgentContext } from '../AgentContext';

export class DeveloperAgent {
  private readonly client = new AIClient();

  async execute(context: AgentContext) {
    if (!context.userId) {
      throw new Error('Authentication required');
    }

    if (!context.generationId) {
      throw new Error('generationId is required');
    }

    if (!context.input?.trim()) {
      throw new Error('Code prompt is required');
    }

    return this.client.generate({
      type: 'code',
      prompt: context.input.trim(),
      generationId: context.generationId,
    });
  }
}
