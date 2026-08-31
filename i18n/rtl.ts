/**
 * CREOVA
 * Right-to-left language support.
 */

import {
  I18nManager,
} from "react-native";

import type {
  SupportedLanguageCode,
} from "./languages";

export const RTL_LANGUAGES = [
  "ar",
  "fa",
  "he",
  "ur",
] as const;

export type RtlLanguageCode =
  (typeof RTL_LANGUAGES)[number];

export function isRtlLanguage(
  languageCode: string,
): boolean {
  return (
    RTL_LANGUAGES as readonly string[]
  ).includes(languageCode);
}

export function getLanguageDirection(
  languageCode: SupportedLanguageCode,
): "ltr" | "rtl" {
  return isRtlLanguage(languageCode)
    ? "rtl"
    : "ltr";
}

export function applyRtlLayout(
  languageCode: SupportedLanguageCode,
): boolean {
  const shouldBeRtl =
    isRtlLanguage(languageCode);

  if (
    I18nManager.isRTL ===
    shouldBeRtl
  ) {
    return false;
  }

  I18nManager.allowRTL(
    shouldBeRtl,
  );

  I18nManager.forceRTL(
    shouldBeRtl,
  );

  return true;
}
