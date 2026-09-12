export type LocalModelCapability =
  | "greeting"
  | "faq"
  | "cached-answer"
  | "simple-classification";

export interface LocalModelDescriptor {
  id: string;
  name: string;
  capabilities: LocalModelCapability[];
  sizeMB: number;
  version: string;
}

export type LocalModelStatus =
  | "not_downloaded"
  | "downloading"
  | "ready"
  | "error";

export interface LocalModelState {
  descriptor: LocalModelDescriptor;
  status: LocalModelStatus;
  lastError?: string;
}

export interface LocalInferenceRequest {
  prompt: string;
  historyHash?: string;
}

export interface LocalInferenceResult {
  content: string;
  source:
    | "cache"
    | "on-device-model"
    | "rule";
  capability: LocalModelCapability;
}

export type RoutingDestination =
  | "local"
  | "cloud"
  | "queued-offline";

export interface RoutingDecision {
  destination: RoutingDestination;
  reason: string;
  estimatedSavings: number;
}

export interface HybridResponse {
  content: string;
  routedTo: RoutingDestination;
  reason: string;
  model?: string;
}
