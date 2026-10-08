import { AgentManager } from "../agents/AgentManager";
import { AgentContext } from "../agents/AgentContext";
import {
  IntentDetector,
  UserIntent,
} from "./IntentDetector";

import type {
  AIMessage,
  AIResponse,
} from "../ai/AIProvider";

import { HybridRouter } from "../ai/HybridRouter";

export class AIRouter {
  private readonly agentManager: AgentManager;
  private readonly hybridRouter: HybridRouter;

  constructor() {
    this.agentManager =
      AgentManager.getInstance();

    this.hybridRouter =
      HybridRouter.getInstance();
  }

  public async routeAndExecute(
    prompt: string,
    context: AgentContext,
  ): Promise<AIResponse> {
    const intent: UserIntent =
      IntentDetector.detectIntent(
        prompt,
      );

    if (intent === "vision") {
      const agent =
        this.agentManager.getAgent(
          "vision-agent",
        );

      if (!agent) {
        throw new Error(
          'Agent "vision-agent" was not found.',
        );
      }

      return agent.process(
        prompt,
        context,
      );
    }

    const messages: AIMessage[] = [
      {
        role: "user",
        content: prompt.trim(),
      },
    ];

    const hybrid =
      await this.hybridRouter.respond(
        messages,
        {
          generationType:
            intent === "code"
              ? "code"
              : "chat",
        },
      );

    if (
      hybrid.routedTo ===
      "queued-offline"
    ) {
      throw new Error(
        "You are offline. This request requires an internet connection.",
      );
    }

    return {
      content:
        hybrid.content,

      model:
        hybrid.model ??
        "creova-hybrid",

      generationId:
        hybrid.routedTo === "local"
          ? "local"
          : "hybrid-cloud",

      routedTo:
        hybrid.routedTo === "local"
          ? "local"
          : "cloud",
    };
  }
            }
