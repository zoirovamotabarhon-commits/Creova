import { Agent } from '../Agent';
import { AgentContext } from '../AgentContext';
import { AIResponse, AIMessage } from '../../ai/AIProvider';
import { FileTool } from '../../tools/code/FileTool';

export class DeveloperAgent extends Agent {
  readonly id = 'developer-agent';
  readonly name = 'Developer Agent';
  readonly description = 'Handles code generation, refactoring, file inspection, and debugging.';
  readonly systemPrompt = `You are an expert AI software engineer. You analyze code structure, assist in editing files, and output full, working TypeScript/React Native code without breaking existing conventions.`;

  constructor() {
    super();
    // Registering developer specific tools
    this.registerTool(new FileTool());
  }

  async process(input: string, context: AgentContext): Promise<AIResponse> {
    const messages: AIMessage[] = [
      { role: 'system', content: this.systemPrompt },
      ...context.history,
      { role: 'user', content: input },
    ];

    return await this.aiClient.chat(messages, {
      temperature: 0.2, // Lower temperature for accurate coding
    });
  }
}

