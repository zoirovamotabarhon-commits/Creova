export type GenerationType =
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

export interface GenerationRequest {
  type: GenerationType;
  prompt: string;
  metadata?: Record<string, unknown>;
}

export interface GenerationResult {
  success: boolean;
  generationId?: string;
  resultText?: string | null;
  resultUrl?: string | null;
  error?: string;
}
