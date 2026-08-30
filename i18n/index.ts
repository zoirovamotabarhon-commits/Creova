/**
 * CREOVA
 * Global internationalization entry point.
 */

import AsyncStorage from
  "@react-native-async-storage/async-storage";

import i18n from "i18next";

import {
  initReactI18next,
} from "react-i18next";

import * as Localization from
  "expo-localization";

import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  I18N_COMPATIBILITY,
} from "./config";

import {
  LANGUAGES,
  isSupportedLanguage,
  type SupportedLanguageCode,
} from "./languages";

import {
  applyRtlLayout,
} from "./rtl";

import en from "./locales/en.json";
import uz from "./locales/uz.json";
import ru from "./locales/ru.json";
import tr from "./locales/tr.json";
import kk from "./locales/kk.json";
import ky from "./locales/ky.json";
import tg from "./locales/tg.json";
import az from "./locales/az.json";
import ar from "./locales/ar.json";
import fa from "./locales/fa.json";
import he from "./locales/he.json";
import ur from "./locales/ur.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";
import nl from "./locales/nl.json";
import sv from "./locales/sv.json";
import no from "./locales/no.json";
import da from "./locales/da.json";
import fi from "./locales/fi.json";
import pl from "./locales/pl.json";
import cs from "./locales/cs.json";
import sk from "./locales/sk.json";

const resources = {
  en: { translation: en },
  uz: { translation: uz },
  ru: { translation: ru },
  tr: { translation: tr },
  kk: { translation: kk },
  ky: { translation: ky },
  tg: { translation: tg },
  az: { translation: az },
  ar: { translation: ar },
  fa: { translation: fa },
  he: { translation: he },
  ur: { translation: ur },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  it: { translation: it },
  pt: { translation: pt },
  nl: { translation: nl },
  sv: { translation: sv },
  no: { translation: no },
  da: { translation: da },
  fi: { translation: fi },
  pl: { translation: pl },
  cs: { translation: cs },
  sk: { translation: sk },
} as const;

const loadedLanguageCodes =
  Object.keys(
    resources,
  ) as SupportedLanguageCode[];

function normalizeLanguageCode(
  value: string | null | undefined,
): SupportedLanguageCode {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    isSupportedLanguage(
      normalized,
    )
  ) {
    return normalized;
  }

  const baseCode =
    normalized.split("-")[0];

  if (
    isSupportedLanguage(
      baseCode,
    )
  ) {
    return baseCode;
  }

  return DEFAULT_LANGUAGE;
}

function resolveDeviceLanguage():
  SupportedLanguageCode {
  try {
    const locale =
      Localization.getLocales()[0];

    return normalizeLanguageCode(
      locale?.languageCode,
    );
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function isLoadedLanguage(
  languageCode: SupportedLanguageCode,
): boolean {
  return loadedLanguageCodes.includes(
    languageCode,
  );
}

async function resolveInitialLanguage():
  Promise<SupportedLanguageCode> {
  try {
    const stored =
      await AsyncStorage.getItem(
        LANGUAGE_STORAGE_KEY,
      );

    if (
      isSupportedLanguage(stored) &&
      isLoadedLanguage(stored)
    ) {
      return stored;
    }
  } catch (error) {
    console.warn(
      "CREOVA: unable to read stored language.",
      error,
    );
  }

  const deviceLanguage =
    resolveDeviceLanguage();

  if (
    isLoadedLanguage(
      deviceLanguage,
    )
  ) {
    return deviceLanguage;
  }

  return DEFAULT_LANGUAGE;
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: DEFAULT_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    compatibilityJSON:
      I18N_COMPATIBILITY,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    returnNull: false,
    returnEmptyString: false,
  })
  .then(async () => {
    const initialLanguage =
      await resolveInitialLanguage();

    await i18n.changeLanguage(
      initialLanguage,
    );

    applyRtlLayout(
      initialLanguage,
    );
  })
  .catch((error) => {
    console.error(
      "CREOVA: i18n initialization failed.",
      error,
    );
  });

export async function setLanguage(
  languageCode: SupportedLanguageCode,
): Promise<boolean> {
  if (
    !isSupportedLanguage(
      languageCode,
    )
  ) {
    return false;
  }

  if (
    !isLoadedLanguage(
      languageCode,
    )
  ) {
    console.warn(
      `CREOVA: locale "${languageCode}" is not loaded yet.`,
    );

    return false;
  }

  try {
    await AsyncStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      languageCode,
    );

    await i18n.changeLanguage(
      languageCode,
    );

    applyRtlLayout(
      languageCode,
    );

    return true;
  } catch (error) {
    console.error(
      "CREOVA: unable to change language.",
      error,
    );

    return false;
  }
}

export async function getStoredLanguage():
  Promise<SupportedLanguageCode | null> {
  try {
    const stored =
      await AsyncStorage.getItem(
        LANGUAGE_STORAGE_KEY,
      );

    return isSupportedLanguage(stored)
      ? stored
      : null;
  } catch {
    return null;
  }
}

export function getCurrentLanguage():
  SupportedLanguageCode {
  return normalizeLanguageCode(
    i18n.language,
  );
}

export function isLanguageLoaded(
  languageCode: SupportedLanguageCode,
): boolean {
  return isLoadedLanguage(
    languageCode,
  );
}

export {
  LANGUAGES,
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
};

export type {
  SupportedLanguageCode,
} from "./languages";

export {
  isRtlLanguage,
  RTL_LANGUAGES,
} from "./rtl";

export default i18n;
