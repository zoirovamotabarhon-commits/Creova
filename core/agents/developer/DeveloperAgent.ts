import { Agent } from '../Agent';
import type { AgentContext } from '../AgentContext';
import type { AIMessage, AIResponse } from '../../ai/AIProvider';

export class DeveloperAgent extends Agent {
  readonly id = 'developer-agent';
  readonly name = 'Developer Agent';
  readonly description =
    'Writes, refactors, and debugs code from natural-language prompts.';
  readonly systemPrompt =
    'You are CREOVA AI Code. Return only the requested code. Do not add explanations unless explicitly requested. Use correct production-ready syntax.';

  async process(
    input: string,
    context: AgentContext,
  ): Promise<AIResponse> {
    if (!context.userId) {
      throw new Error('Authentication required');
    }

    const prompt = input.trim();

    if (!prompt) {
      throw new Error('Code prompt is required');
    }

    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: prompt },
    ];

    return this.aiClient.chat(messages, {
      generationType: 'code',
      generationId: context.generationId,
    });
  }
}
