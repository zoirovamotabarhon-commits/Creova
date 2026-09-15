import { Agent } from "../Agent";
import type { AgentContext } from "../AgentContext";
import type {
  AIMessage,
  AIResponse,
} from "../../ai/AIProvider";

export class VisionAgent
  extends Agent {
  readonly id =
    "vision-agent";

  readonly name =
    "Vision Agent";

  readonly description =
    "Analyzes screenshots, photos, UI designs, documents, and other images.";

  readonly systemPrompt =
    "You are CREOVA AI Vision. Analyze the supplied image accurately. Describe what is visible, identify UI elements, objects, text, layout problems, and visual details relevant to the user's request. Never claim to see information that is not actually present in the image.";

  async process(
    input: string,
    context: AgentContext,
  ): Promise<AIResponse> {
    if (!context.userId) {
      throw new Error(
        "Authentication required",
      );
    }

    const imageUrl =
      context.imageUrl?.trim();

    if (!imageUrl) {
      throw new Error(
        "Image URL is required for Vision AI.",
      );
    }

    const prompt =
      input.trim();

    if (!prompt) {
      throw new Error(
        "Vision prompt is required.",
      );
    }

    const messages: AIMessage[] =
      [
        {
          role: "system",
          content:
            this.systemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ];

    return this.hybridChat(
      messages,
      context,
      {
        generationType:
          "vision",

        imageUrl,
      },
    );
  }
  }
