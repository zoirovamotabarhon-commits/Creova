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

export async function generateAIText({
  prompt,
}: AIRequest) {
  return generateText(prompt);
}

export async function generateAIImage({
  prompt,
}: AIRequest) {
  return generateImage(prompt);
}

export async function generateAIVideo({
  prompt,
}: AIRequest) {
  return generateVideo(prompt);
}

export async function generateAIMusic({
  prompt,
}: AIRequest) {
  return generateMusic(prompt);
}

export async function generateAIVoice({
  prompt,
}: AIRequest) {
  return generateVoice(prompt);
}
