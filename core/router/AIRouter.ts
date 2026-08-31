import { IntentDetector } from './IntentDetector';
import { AgentManager } from '../agents/AgentManager';
import { AgentContext } from '../agents/AgentContext';
import { AIResponse } from '../ai/AIProvider';

export class AIRouter {
  private agentManager: AgentManager;

  constructor() {
    this.agentManager = AgentManager.getInstance();
  }

  public async routeAndExecute(
    input: string,
    context: AgentContext
  ): Promise<AIResponse> {
    const intent = IntentDetector.detectIntent(input);

    let agentId = 'chat-agent';
    if (intent === 'code') {
      agentId = 'developer-agent';
    }

    const agent = this.agentManager.getAgent(agentId) || this.agentManager.getAgent('developer-agent');

    if (!agent) {
      throw new Error(`No suitable agent found for intent: ${intent}`);
    }

    return await agent.process(input, context);
  }
}

