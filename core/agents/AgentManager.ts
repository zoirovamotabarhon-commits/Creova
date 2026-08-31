import { Agent } from './Agent';

export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<string, Agent> = new Map();

  private constructor() {}

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  public listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}

