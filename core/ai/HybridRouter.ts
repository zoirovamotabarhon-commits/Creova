import NetInfo from "@react-native-community/netinfo";

import { AIClient } from "./AIClient";

import {
  LocalInferenceEngine,
} from "./LocalInferenceEngine";

import type {
  AIMessage,
  AIOptions,
} from "./AIProvider";

import type {
  HybridResponse,
  RoutingDecision,
} from "../../types/ai-local";

const ESTIMATED_CLOUD_CALL_COST = 1;

export class HybridRouter {
  private static instance:
    | HybridRouter
    | undefined;

  private readonly localEngine:
    LocalInferenceEngine;

  private constructor() {
    this.localEngine =
      LocalInferenceEngine.getInstance();
  }

  public static getInstance(): HybridRouter {
    if (!HybridRouter.instance) {
      HybridRouter.instance =
        new HybridRouter();
    }

    return HybridRouter.instance;
  }

  public async decide(
    prompt: string,
  ): Promise<RoutingDecision> {
    const network =
      await NetInfo.fetch();

    const isOnline =
      network.isConnected === true;

    const localCanHandle =
      this.localEngine.canLikelyHandle(
        prompt,
      );

    if (localCanHandle) {
      return {
        destination: "local",

        reason:
          "The request can be answered by the on-device rule/cache layer.",

        estimatedSavings:
          ESTIMATED_CLOUD_CALL_COST,
      };
    }

    if (!isOnline) {
      return {
        destination:
          "queued-offline",

        reason:
          "The device is offline and this request requires the cloud model.",

        estimatedSavings: 0,
      };
    }

    return {
      destination: "cloud",

      reason:
        "The request requires cloud AI capabilities.",

      estimatedSavings: 0,
    };
  }

  public async respond(
    messages: AIMessage[],
    options: AIOptions = {},
  ): Promise<HybridResponse> {
    const lastUserMessage =
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "user",
        );

    const prompt =
      lastUserMessage?.content ?? "";

    if (!prompt.trim()) {
      throw new Error(
        "A user prompt is required.",
      );
    }

    /*
     * Vision must always use the cloud
     * multimodal provider.
     *
     * Do not send Vision requests through
     * local rules or cache.
     */
    const requiresCloudVision =
      options.generationType ===
        "vision" ||
      Boolean(options.imageUrl);

    const decision =
      requiresCloudVision
        ? {
            destination:
              "cloud" as const,

            reason:
              "Vision requests require the cloud multimodal model and must not be handled by local text rules or cache.",

            estimatedSavings: 0,
          }
        : await this.decide(
            prompt,
          );

    if (
      decision.destination ===
      "local"
    ) {
      const localResult =
        await this.localEngine.infer({
          prompt,
        });

      if (localResult) {
        return {
          content:
            localResult.content,

          routedTo: "local",

          reason:
            decision.reason,

          model:
            localResult.source ===
            "cache"
              ? "creova-cache"
              : "creova-local-rules",
        };
      }
    }

    if (
      decision.destination ===
      "queued-offline"
    ) {
      return {
        content: "",

        routedTo:
          "queued-offline",

        reason:
          decision.reason,
      };
    }

    const client =
      AIClient.getInstance();

    const cloudResult =
      await client.chat(
        messages,
        options,
      );

    /*
     * Do not cache Vision responses.
     * Images may contain sensitive/private data.
     */
    if (!requiresCloudVision) {
      await this.localEngine.rememberCloudAnswer(
        prompt,
        cloudResult.content,
      );
    }

    return {
      content:
        cloudResult.content,

      routedTo: "cloud",

      reason:
        decision.reason,

      model:
        cloudResult.model,
    };
  }
        }
