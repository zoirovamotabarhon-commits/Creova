import { Agent } from './Agent';
import { DeveloperAgent } from './developer/DeveloperAgent';
import { VisionAgent } from './vision/VisionAgent';

export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<string, Agent> = new Map();

  private constructor() {
    // Register default core agents automatically on initialization
    this.registerAgent(new DeveloperAgent());
    this.registerAgent(new VisionAgent());
  }

  public static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * Registers a new agent into the manager registry.
   */
  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  /**
   * Retrieves an agent by its unique identifier.
   */
  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /**
   * Returns a list of all currently registered agents.
   */
  public listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }
}
