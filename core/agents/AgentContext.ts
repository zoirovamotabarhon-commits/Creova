import { AIMessage } from '../ai/AIProvider';

export interface AgentContext {
  userId?: string;
  projectId?: string;
  conversationId?: string;
  history: AIMessage[];
  metadata?: Record<string, any>;
}
