/**
 * CREOVA
 * Centralized application routes.
 */

export const ROUTES = {
  HOME: "/",

  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  DASHBOARD: "/dashboard",

  AI_CHAT: "/ai-chat",
  AI_IMAGE: "/ai-image",
  AI_VIDEO: "/ai-video",
  AI_MUSIC: "/ai-music",
  AI_VOICE: "/ai-voice",
  AI_CODE: "/ai-code",

  PROFILE: "/profile",
  SETTINGS: "/settings",

  PREMIUM: "/premium",
  PREMIUM_PLANS: "/premium/plans",
  PREMIUM_CHECKOUT: "/premium/checkout",
  PREMIUM_SUCCESS: "/premium/success",
} as const;

export type AppRoute =
  (typeof ROUTES)[keyof typeof ROUTES];

export const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
] as const;

export const PROTECTED_ROUTES = [
  ROUTES.DASHBOARD,
  ROUTES.AI_CHAT,
  ROUTES.AI_IMAGE,
  ROUTES.AI_VIDEO,
  ROUTES.AI_MUSIC,
  ROUTES.AI_VOICE,
  ROUTES.AI_CODE,
  ROUTES.PROFILE,
  ROUTES.SETTINGS,
  ROUTES.PREMIUM,
  ROUTES.PREMIUM_PLANS,
  ROUTES.PREMIUM_CHECKOUT,
  ROUTES.PREMIUM_SUCCESS,
] as const;

export function matchesRoute(
  pathname: string,
  route: string,
): boolean {
  return (
    pathname === route ||
    pathname.startsWith(
      `${route}/`,
    )
  );
}
