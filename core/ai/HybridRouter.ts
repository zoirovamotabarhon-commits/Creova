/**
 * CREOVA
 * HybridRouter
 *
 * Decides whether a request can be answered on-device for free
 * (LocalInferenceEngine) or must go to the paid cloud model (AIClient).
 * This is the single place that trades off cost vs. capability, so agents
 * and screens don't need to know about local models at all.
 *
 * Policy, in order:
 *  1. Offline + not answerable locally -> queue for later (caller decides
 *     how to surface that to the user), never silently fail.
 *  2. Answerable locally (greeting/FAQ/cached) -> answer for free.
 *  3. Otherwise -> cloud call, then remember the answer for cache reuse.
 */

import NetInfo from "@react-native-community/netinfo";

import { AIClient } from "./AIClient";
import { LocalInferenceEngine } from "./LocalInferenceEngine";
import type { AIMessage } from "./AIProvider";
import type { HybridResponse, RoutingDecision } from "../../types/ai-local";

const ESTIMATED_CLOUD_CALL_COST = 1; // in coin units, for savings reporting only

export class HybridRouter {
  private static instance: HybridRouter;

  private localEngine: LocalInferenceEngine;

  private constructor() {
    this.localEngine = LocalInferenceEngine.getInstance();
  }

  public static getInstance(): HybridRouter {
    if (!HybridRouter.instance) {
      HybridRouter.instance = new HybridRouter();
    }

    return HybridRouter.instance;
  }

  public async decide(prompt: string): Promise<RoutingDecision> {
    const netState = await NetInfo.fetch();
    const isOnline = !!netState.isConnected;
    const localCanHandle = this.localEngine.canLikelyHandle(prompt);

    if (localCanHandle) {
      return {
        destination: "local",
        reason: "Matched a built-in rule/FAQ or recent cached answer",
        estimatedSavings: ESTIMATED_CLOUD_CALL_COST,
      };
    }

    if (!isOnline) {
      return {
        destination: "queued-offline",
        reason: "Device is offline and the prompt needs the cloud model",
        estimatedSavings: 0,
      };
    }

    return {
      destination: "cloud",
      reason: "Needs the full cloud model",
      estimatedSavings: 0,
    };
  }

  /**
   * Main entry point. Throws only when routed to the cloud and the cloud
   * call itself fails — callers already handle AIClient errors today.
   * When queued offline, returns a HybridResponse with `routedTo:
   * "queued-offline"` and no content, so the caller can enqueue the
   * request (see hooks/useOfflineSync) instead of showing a raw error.
   */
  public async respond(messages: AIMessage[]): Promise<HybridResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const prompt = lastUserMessage?.content ?? "";

    const decision = await this.decide(prompt);

    if (decision.destination === "local") {
      const localResult = await this.localEngine.infer({ prompt });

      if (localResult) {
        return {
          content: localResult.content,
          routedTo: "local",
          reason: decision.reason,
        };
      }

      // Local match looked promising but didn't actually resolve (e.g. cache
      // expired between canLikelyHandle and infer) — fall through to cloud.
    }

    if (decision.destination === "queued-offline") {
      return {
        content: "",
        routedTo: "queued-offline",
        reason: decision.reason,
      };
    }

    const client = AIClient.getInstance();
    const cloudResult = await client.chat(messages);

    await this.localEngine.rememberCloudAnswer(prompt, cloudResult.content);

    return {
      content: cloudResult.content,
      routedTo: "cloud",
      reason: decision.reason,
      model: cloudResult.model,
    };
  }
        }
