import type {
  GenerationType,
  GenerationStatus,
} from "./generation";

export type { GenerationType, GenerationStatus };

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
