import {
  generateChat,
  AIMessage,
} from "./chat";

import { generateCode } from "./code";
import { generateImage } from "./image";
import { generateMusic } from "./music";
import { generateVideo } from "./video";
import { generateVoice } from "./voice";

export {
  generateChat,
  generateCode,
  generateImage,
  generateMusic,
  generateVideo,
  generateVoice,
};

export type {
  AIMessage,
};

export type AIFeature =
  | "chat"
  | "code"
  | "image"
  | "music"
  | "video"
  | "voice";

export async function generateAI(
  feature: AIFeature,
  prompt: string,
) {
  switch (feature) {
    case "chat":
      return generateChat(
        prompt,
      );

    case "code":
      return generateCode(
        prompt,
      );

    case "image":
      return generateImage(
        prompt,
      );

    case "music":
      return generateMusic(
        prompt,
      );

    case "video":
      return generateVideo(
        prompt,
      );

    case "voice":
      return generateVoice(
        prompt,
      );

    default:
      return {
        success: false,
        error:
          "Unsupported AI feature.",
      };
  }
}
