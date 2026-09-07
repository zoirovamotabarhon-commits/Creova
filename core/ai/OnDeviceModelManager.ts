/**
 * CREOVA
 * OnDeviceModelManager
 *
 * Tracks which lightweight, on-device capabilities are available so the
 * HybridRouter can answer common requests for free instead of calling the
 * paid cloud model.
 *
 * IMPORTANT: this project does not currently bundle a real on-device LLM
 * runtime (e.g. llama.rn, ExecuTorch, MLC). "Models" here are intentionally
 * lightweight rule/cache-based capabilities that need no native binary.
 * The registry shape below is designed so a real model can be dropped in
 * later (see LocalInferenceEngine) without changing callers of this class.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  LocalModelDescriptor,
  LocalModelState,
  LocalModelStatus,
} from "../../types/ai-local";

const STORAGE_KEY = "creova:on-device-models:state";

const BUILT_IN_MODELS: LocalModelDescriptor[] = [
  {
    id: "rules-v1",
    name: "Built-in rules & greetings",
    capabilities: ["greeting", "faq"],
    sizeMB: 0,
    version: "1.0.0",
  },
  {
    id: "response-cache-v1",
    name: "Recent answer cache",
    capabilities: ["cached-answer"],
    sizeMB: 0,
    version: "1.0.0",
  },
];

export class OnDeviceModelManager {
  private static instance: OnDeviceModelManager;

  private state: Map<string, LocalModelState> = new Map();
  private loaded = false;

  private constructor() {}

  public static getInstance(): OnDeviceModelManager {
    if (!OnDeviceModelManager.instance) {
      OnDeviceModelManager.instance = new OnDeviceModelManager();
    }

    return OnDeviceModelManager.instance;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    for (const descriptor of BUILT_IN_MODELS) {
      this.state.set(descriptor.id, {
        descriptor,
        status: "ready",
      });
    }

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (raw) {
        const persisted = JSON.parse(raw) as Record<string, LocalModelState>;

        for (const [id, savedState] of Object.entries(persisted)) {
          if (this.state.has(id)) {
            this.state.set(id, savedState);
          }
        }
      }
    } catch {
      // No persisted state is fine; built-ins above already cover the defaults.
    }

    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const plain: Record<string, LocalModelState> = {};

    for (const [id, value] of this.state.entries()) {
      plain[id] = value;
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(plain));
    } catch {
      // Best-effort persistence only.
    }
  }

  public async getAll(): Promise<LocalModelState[]> {
    await this.ensureLoaded();
    return Array.from(this.state.values());
  }

  public async isCapabilityReady(
    capability: LocalModelDescriptor["capabilities"][number]
  ): Promise<boolean> {
    await this.ensureLoaded();

    for (const entry of this.state.values()) {
      if (
        entry.status === "ready" &&
        entry.descriptor.capabilities.includes(capability)
      ) {
        return true;
      }
    }

    return false;
  }

  public async setStatus(
    modelId: string,
    status: LocalModelStatus,
    error?: string
  ): Promise<void> {
    await this.ensureLoaded();

    const current = this.state.get(modelId);

    if (!current) {
      return;
    }

    this.state.set(modelId, {
      ...current,
      status,
      lastError: error,
    });

    await this.persist();
  }
}
