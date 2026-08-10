export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",

  DASHBOARD: "/dashboard",

  AI_CHAT: "/ai-chat",
  AI_IMAGE: "/ai-image",
  AI_VIDEO: "/ai-video",
  AI_MUSIC: "/ai-music",
  AI_VOICE: "/ai-voice",
  AI_CODE: "/ai-code",

  PROFILE: "/profile",
  SETTINGS: "/settings",
} as const;

export type AppRoute =
  (typeof ROUTES)[keyof typeof ROUTES];
