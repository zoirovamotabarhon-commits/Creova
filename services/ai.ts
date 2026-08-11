import { generateText } from "./openai";
import { generateImage } from "./image";
import { generateVideo } from "./video";
import { generateMusic } from "./music";
import { generateVoice } from "./voice";

export type AIProvider = "openai";

export interface AIRequest {
  prompt: string;
  provider?: AIProvider;
}

function validatePrompt(prompt: string): string {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error("Prompt is required.");
  }

  return cleanPrompt;
}

export async function generateAIText({
  prompt,
  provider = "openai",
}: AIRequest) {
  const cleanPrompt = validatePrompt(prompt);

  if (provider !== "openai") {
    return {
      success: false,
      error: `Unsupported AI provider: ${provider}`,
    };
  }

  return generateText(cleanPrompt);
}

export async function generateAIImage({
  prompt,
}: AIRequest) {
  return generateImage(validatePrompt(prompt));
}

export async function generateAIVideo({
  prompt,
}: AIRequest) {
  return generateVideo(validatePrompt(prompt));
}

export async function generateAIMusic({
  prompt,
}: AIRequest) {
  return generateMusic(validatePrompt(prompt));
}

export async function generateAIVoice({
  prompt,
}: AIRequest) {
  return generateVoice(validatePrompt(prompt));
                                      }
