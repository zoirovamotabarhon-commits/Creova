/**
 * CREOVA
 * LocalInferenceEngine
 *
 * Answers what it safely can on-device, for free, before HybridRouter
 * considers a paid cloud call.
 *
 * Two independent strategies:
 *  1. Rules: greetings and a small FAQ table.
 *  2. Response cache: reuse recent cloud answers.
 */

import { getCached, setCached, hashString } from "../../services/cache";
import { OnDeviceModelManager } from "./OnDeviceModelManager";
import type {
  LocalInferenceRequest,
  LocalInferenceResult,
} from "../../types/ai-local";

const RESPONSE_CACHE_TTL_MS = 1000 * 60 * 30;
const RESPONSE_CACHE_PREFIX = "ai-response:";

const GREETING_PATTERNS = [
  /^\s*(hi|hello|hey|salom|assalomu\s*alaykum)\s*[!.?]*\s*$/i,
];

const FAQ_TABLE: Array<{ pattern: RegExp; answer: string }> = [
  {
    pattern: /what\s+can\s+you\s+do|nima\s+qila\s+olasan/i,
    answer:
      "I can help with chat, code, and vision/design tasks. Ask me anything to get started.",
  },
  {
    pattern: /who\s+(are|made)\s+you|kim\s+yaratgan/i,
    answer:
      "I'm the CREOVA AI assistant, here to help inside this app.",
  },
];

function normalize(prompt: string): string {
  return prompt.trim().toLowerCase();
}

export class LocalInferenceEngine {
  private static instance: LocalInferenceEngine;

  private modelManager: OnDeviceModelManager;

  private constructor() {
    this.modelManager = OnDeviceModelManager.getInstance();
  }

  public static getInstance(): LocalInferenceEngine {
    if (!LocalInferenceEngine.instance) {
      LocalInferenceEngine.instance = new LocalInferenceEngine();
    }

    return LocalInferenceEngine.instance;
  }

  public canLikelyHandle(prompt: string): boolean {
    const normalized = normalize(prompt);

    if (!normalized) {
      return false;
    }

    if (GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return true;
    }

    if (FAQ_TABLE.some((entry) => entry.pattern.test(normalized))) {
      return true;
    }

    return false;
  }

  public async infer(
    request: LocalInferenceRequest
  ): Promise<LocalInferenceResult | null> {
    const normalized = normalize(request.prompt);

    if (!normalized) {
      return null;
    }

    if (
      (await this.modelManager.isCapabilityReady("greeting")) &&
      GREETING_PATTERNS.some((pattern) => pattern.test(normalized))
    ) {
      return {
        content: "Hello! How can I help you today?",
        source: "rule",
        capability: "greeting",
      };
    }

    if (await this.modelManager.isCapabilityReady("faq")) {
      const match = FAQ_TABLE.find((entry) =>
        entry.pattern.test(normalized)
      );

      if (match) {
        return {
          content: match.answer,
          source: "rule",
          capability: "faq",
        };
      }
    }

    if (await this.modelManager.isCapabilityReady("cached-answer")) {
      const cached = await getCached<string>(
        this.cacheKey(normalized)
      );

      if (cached) {
        return {
          content: cached,
          source: "cache",
          capability: "cached-answer",
        };
      }
    }

    return null;
  }

  public async rememberCloudAnswer(
    prompt: string,
    answer: string
  ): Promise<void> {
    const normalized = normalize(prompt);

    if (!normalized || !answer) {
      return;
    }

    await setCached(
      this.cacheKey(normalized),
      answer,
      RESPONSE_CACHE_TTL_MS
    );
  }

  private cacheKey(normalizedPrompt: string): string {
    return `${RESPONSE_CACHE_PREFIX}${hashString(normalizedPrompt)}`;
  }
}
