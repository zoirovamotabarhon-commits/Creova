/**
 * CREOVA
 * Types shared by the on-device AI layer (core/ai) and the hybrid
 * local/cloud router. Kept separate from types/ai.ts, which describes
 * the cloud generation domain model.
 */

export type LocalModelCapability =
  | "greeting"
  | "faq"
  | "cached-answer"
  | "simple-classification";

export interface LocalModelDescriptor {
  id: string;
  name: string;
  capabilities: LocalModelCapability[];
  /** Approximate on-disk size, used to warn before downloading on metered connections. */
  sizeMB: number;
  version: string;
}

export type LocalModelStatus = "not_downloaded" | "downloading" | "ready" | "error";

export interface LocalModelState {
  descriptor: LocalModelDescriptor;
  status: LocalModelStatus;
  lastError?: string;
}

export interface LocalInferenceRequest {
  prompt: string;
  /** Optional short history, used only for cache-key hashing, not full context reasoning. */
  historyHash?: string;
}

export interface LocalInferenceResult {
  content: string;
  source: "cache" | "on-device-model" | "rule";
  capability: LocalModelCapability;
}

export type RoutingDestination = "local" | "cloud" | "queued-offline";

export interface RoutingDecision {
  destination: RoutingDestination;
  reason: string;
  /** Estimated coin/API cost saved by not calling the cloud, 0 when routed to cloud. */
  estimatedSavings: number;
}

export interface HybridResponse {
  content: string;
  routedTo: RoutingDestination;
  reason: string;
  model?: string;
  }
