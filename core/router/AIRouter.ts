import { AgentManager } from '../agents/AgentManager';
import { AgentContext } from '../agents/AgentContext';
import { IntentDetector, UserIntent } from './IntentDetector';
import { AIResponse } from '../ai/AIProvider';

export class AIRouter {
  private agentManager: AgentManager;

  constructor() {
    this.agentManager = AgentManager.getInstance();
  }

  /**
   * Routes incoming user prompt to appropriate agent based on detected intent,
   * then executes it and returns the AI response.
   */
  public async routeAndExecute(
    prompt: string,
    context: AgentContext
  ): Promise<AIResponse> {
    const intent: UserIntent = IntentDetector.detectIntent(prompt);

    let agentId: string;

    switch (intent) {
      case 'vision':
        agentId = 'vision-agent';
        break;
      case 'code':
      case 'chat':
      case 'media':
      case 'unknown':
      default:
        agentId = 'developer-agent';
        break;
    }

    const targetAgent = this.agentManager.getAgent(agentId);

    if (!targetAgent) {
      throw new Error(`Agent with ID "${agentId}" was not found in registry.`);
    }

    return await targetAgent.process(prompt, context);
  }
}
