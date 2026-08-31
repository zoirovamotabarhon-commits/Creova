import { AgentManager } from '../agents/AgentManager';
import { AgentContext } from '../agents/AgentContext';
import { IntentDetector, UserIntent } from './IntentDetector';
import { AIProvider } from '../ai/AIProvider';

export class AIRouter {
  private agentManager: AgentManager;

  constructor() {
    this.agentManager = AgentManager.getInstance();
  }

  /**
   * Routes incoming user prompt to appropriate agent based on detected intent.
   */
  public async routeRequest(
    prompt: string,
    context: AgentContext,
    provider: AIProvider
  ): Promise<string> {
    const intent: UserIntent = IntentDetector.detectIntent(prompt);

    let agentId: string;

    switch (intent) {
      case 'VISUAL':
        agentId = 'vision-agent';
        break;
      case 'CODE':
      case 'DEFAULT':
      default:
        agentId = 'developer-agent';
        break;
    }

    const targetAgent = this.agentManager.getAgent(agentId);

    if (!targetAgent) {
      throw new Error(`Agent with ID "${agentId}" was not found in registry.`);
    }

    return await targetAgent.execute(prompt, context, provider);
  }
}
