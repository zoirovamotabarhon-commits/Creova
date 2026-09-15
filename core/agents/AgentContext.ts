export interface AgentContext {
  userId: string;

  generationId?: string;

  input?: string;

  imageUrl?: string;

  metadata?: Record<
    string,
    unknown
  >;
}
