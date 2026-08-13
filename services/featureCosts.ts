export type GenerationType =
  | "chat"
  | "code"
  | "image"
  | "video"
  | "music"
  | "voice";

export const FEATURE_COSTS: Record<
  GenerationType,
  number
> = {
  chat: 1,
  code: 2,
  image: 5,
  video: 15,
  music: 10,
  voice: 5,
};

export function getFeatureCost(
  type: GenerationType
): number {
  return FEATURE_COSTS[type];
}
