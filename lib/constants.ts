export const APP_NAME = "CREOVA";
export const APP_VERSION = "1.0.0";

export const COIN_COSTS = {
  chat: 1,
  code: 2,
  image: 5,
  voice: 5,
  music: 10,
  video: 15,
} as const;

export const POLL_INTERVAL_MS = 5000;
export const MAX_POLL_ATTEMPTS = 60;

export const EDGE_FUNCTIONS = {
  openaiChat: "openai-chat",
  imageGenerate: "image-generate",
  videoGenerate: "video-generate",
  musicGenerate: "music-generate",
  voiceGenerate: "voice-generate",
  coinOperation: "coin-operation",
  generationRecord: "generation-record",
  generationUpdate: "generation-update",
  subscriptionCheckout: "subscription-checkout",
} as const;
