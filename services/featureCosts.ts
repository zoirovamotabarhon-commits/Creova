import type { GenerationType } from "./generation";

export type { GenerationType };

export const FEATURE_COSTS: Readonly<
  Record<GenerationType, number>
> = Object.freeze({
  chat: 1,
  code: 2,
  image: 5,
  video: 15,
  music: 10,
  voice: 5,
  vision: 5,
});

export function getFeatureCost(
  type: GenerationType
): number {
  return FEATURE_COSTS[type];
}

export function hasEnoughCoins(
  balance: number,
  type: GenerationType
): boolean {
  return (
    Number.isFinite(balance) &&
    balance >=
      getFeatureCost(type)
  );
}
