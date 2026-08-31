import { AIClient } from '../ai/AIClient';
import { Tool } from '../tools/Tool';
import { AgentContext } from './AgentContext';
import { AIResponse } from '../ai/AIProvider';

export abstract class Agent {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly systemPrompt: string;

  protected aiClient: AIClient;
  protected tools: Map<string, Tool> = new Map();

  constructor() {
    this.aiClient = AIClient.getInstance();
  }

  public registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  public getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Executes the main task logic for the agent.
   */
  abstract process(
    input: string,
    context: AgentContext
  ): Promise<AIResponse>;
}

