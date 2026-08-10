import { generateText } from "./openai";
import { generateImage } from "./image";
import { generateVideo } from "./video";
import { generateMusic } from "./music";
import { generateVoice } from "./voice";

export type AIProvider =
  | "openai"
  | "gemini"
  | "claude"
  | "grok"
  | "deepseek"
  | "mistral";

export interface AIRequest {
  prompt: string;
  provider?: AIProvider;
}

function cleanPrompt(prompt: string): string {
  const value = prompt.trim();

  if (!value) {
    throw new Error("Prompt is required.");
  }

  return value;
}

function validateTextProvider(
  provider: AIProvider
): void {
  if (provider !== "openai") {
    throw new Error(
      `AI provider "${provider}" is not implemented yet.`
    );
  }
}

export async function generateAIText({
  prompt,
  provider = "openai",
}: AIRequest) {
  const clean = cleanPrompt(prompt);

  validateTextProvider(provider);

  return generateText(clean);
}

export async function generateAIImage({
  prompt,
}: AIRequest) {
  const clean = cleanPrompt(prompt);

  return generateImage(clean);
}

export async function generateAIVideo({
  prompt,
}: AIRequest) {
  const clean = cleanPrompt(prompt);

  return generateVideo(clean);
}

export async function generateAIMusic({
  prompt,
}: AIRequest) {
  const clean = cleanPrompt(prompt);

  return generateMusic(clean);
}

export async function generateAIVoice({
  prompt,
}: AIRequest) {
  const clean = cleanPrompt(prompt);

  return generateVoice(clean);
}
