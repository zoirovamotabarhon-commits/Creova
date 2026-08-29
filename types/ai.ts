export type AIFeature =
  | "chat"
  | "code"
  | "image"
  | "video"
  | "music"
  | "voice";

export type GenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GenerationRecord {
  id: string;
  userId: string;
  type: AIFeature;
  status: GenerationStatus;
  coinCost: number;
  prompt?: string;
  metadata?: Record<string, unknown>;
  resultText?: string | null;
  resultUrl?: string | null;
  provider?: string | null;
  model?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface GenerationResult<T = unknown> {
  success: boolean;
  generationId?: string;
  data?: T;
  error?: string;
}
