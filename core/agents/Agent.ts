import { AIClient } from "../ai/AIClient";
import { HybridRouter } from "../ai/HybridRouter";
import { Tool } from "../tools/Tool";
import {
  AgentContext,
} from "./AgentContext";
import {
  AIMessage,
  AIResponse,
} from "../ai/AIProvider";

export abstract class Agent {
  abstract readonly id: string;

  abstract readonly name: string;

  abstract readonly description: string;

  abstract readonly systemPrompt: string;

  protected readonly aiClient: AIClient;

  protected readonly hybridRouter: HybridRouter;

  protected tools: Map<
    string,
    Tool
  > = new Map();

  constructor() {
    this.aiClient =
      AIClient.getInstance();

    this.hybridRouter =
      HybridRouter.getInstance();
  }

  public registerTool(
    tool: Tool,
  ): void {
    this.tools.set(
      tool.name,
      tool,
    );
  }

  public getTools(): Tool[] {
    return Array.from(
      this.tools.values(),
    );
  }

  protected async hybridChat(
    messages: AIMessage[],
    context: AgentContext,
    options: {
      generationType?:
        | "chat"
        | "code"
        | "vision";

      imageUrl?: string;
    } = {},
  ): Promise<AIResponse> {
    const result =
      await this.hybridRouter.respond(
        messages,
        {
          generationType:
            options.generationType ??
            "chat",

          imageUrl:
            options.imageUrl,
        },
      );

    if (
      result.routedTo ===
      "queued-offline"
    ) {
      throw new Error(
        "You are offline. This request requires an internet connection.",
      );
    }

    return {
      content:
        result.content,

      model:
        result.model ??
        "creova-hybrid",

      generationId:
        result.routedTo ===
        "local"
          ? "local"
          : context.generationId ??
            "hybrid-cloud",

      routedTo:
        result.routedTo ===
        "local"
          ? "local"
          : "cloud",
    };
  }

  abstract process(
    input: string,
    context: AgentContext,
  ): Promise<AIResponse>;
}
