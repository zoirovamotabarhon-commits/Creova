import { I18nManager } from "react-native";

export const RTL_LANGUAGES = [
  "ar",
  "fa",
  "he",
  "ur",
];

export function isRtlLanguage(
  languageCode: string
): boolean {
  return RTL_LANGUAGES.includes(languageCode);
}

export function applyRtlLayout(
  languageCode: string
): void {
  const shouldBeRtl = isRtlLanguage(languageCode);

  if (I18nManager.isRTL !== shouldBeRtl) {
    I18nManager.allowRTL(shouldBeRtl);
    I18nManager.forceRTL(shouldBeRtl);
  }
}
