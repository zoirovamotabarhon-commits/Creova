import { AIClient } from "../core/ai/AIClient";

export interface VisionRequest {
  imageUrl: string;
  prompt?: string;
  generationId?: string;
}

export interface VisionResponse {
  content: string;
  generationId?: string;
  model?: string;
  modality?: "vision";
}

export async function analyzeImage(
  request: VisionRequest,
): Promise<VisionResponse> {
  if (!request.imageUrl) {
    throw new Error(
      "Image URL is required.",
    );
  }

  const prompt =
    request.prompt?.trim() ||
    "Analyze this image and describe the important visible details.";

  const client =
    AIClient.getInstance();

  const response =
    await client.chat(
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        generationType: "vision",
        generationId:
          request.generationId,
        imageUrl: request.imageUrl,
      },
    );

  return {
    content: response.content,
    generationId:
      response.generationId,
    model: response.model,
    modality: "vision",
  };
}
