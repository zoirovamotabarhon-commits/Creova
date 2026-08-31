import { Agent } from '../Agent';
import { AgentContext } from '../AgentContext';
import { AIResponse, AIMessage } from '../../ai/AIProvider';
import { VisionTool } from '../../tools/vision/VisionTool';

export class VisionAgent extends Agent {
  readonly id = 'vision-agent';
  readonly name = 'Vision Agent';
  readonly description = 'Handles visual inputs, UI mockups to code conversion, and image recognition tasks.';
  readonly systemPrompt = `You are an expert AI vision assistant. You excel at inspecting software UI mockups, architectural diagrams, and error screenshots, converting visual designs into clean React Native components.`;

  constructor() {
    super();
    this.registerTool(new VisionTool());
  }

  async process(input: string, context: AgentContext): Promise<AIResponse> {
    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...context.history,
      { role: 'user', content: input },
    ];

    return await this.aiClient.chat(messages, {
      temperature: 0.4,
    });
  }
}
