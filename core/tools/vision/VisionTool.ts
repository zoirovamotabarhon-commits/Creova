import { AIClient } from "../../ai/AIClient";

export interface VisionToolInput {
  imageUrl: string;
  prompt?: string;
  generationId?: string;
}

export interface VisionToolResult {
  success: boolean;
  content: string;
  generationId?: string;
}

export class VisionTool {
  private readonly client: AIClient;

  constructor() {
    this.client =
      AIClient.getInstance();
  }

  async execute(
    input: VisionToolInput,
  ): Promise<VisionToolResult> {
    if (!input.imageUrl) {
      throw new Error(
        "VisionTool requires imageUrl.",
      );
    }

    const prompt =
      input.prompt?.trim() ||
      "Analyze this image and describe the important visible details.";

    const response =
      await this.client.chat(
        [
          {
            role: "user",
            content: prompt,
          },
        ],
        {
          generationType: "vision",
          generationId:
            input.generationId,
          imageUrl: input.imageUrl,
        },
      );

    return {
      success: true,
      content: response.content,
      generationId:
        response.generationId,
    };
  }
}

export const visionTool =
  new VisionTool();
