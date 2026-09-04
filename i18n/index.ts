/**
 * CREOVA
 * Global internationalization entry point.
 */

import AsyncStorage from
  "@react-native-async-storage/async-storage";

import * as Localization from
  "expo-localization";

import i18n from "i18next";

import {
  initReactI18next,
} from "react-i18next";

import {
  LANGUAGES,
  isSupportedLanguage,
  type SupportedLanguageCode,
} from "./languages";

import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  I18N_COMPATIBILITY,
} from "./config";

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
import sl from "./locales/sl.json";
import hu from "./locales/hu.json";
import ro from "./locales/ro.json";
import bg from "./locales/bg.json";
import uk from "./locales/uk.json";
import el from "./locales/el.json";
import hr from "./locales/hr.json";
import sr from "./locales/sr.json";
import lt from "./locales/lt.json";
import lv from "./locales/lv.json";
import et from "./locales/et.json";
import ka from "./locales/ka.json";
import hy from "./locales/hy.json";
import zh from "./locales/zh.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import hi from "./locales/hi.json";
import bn from "./locales/bn.json";
import id from "./locales/id.json";
import ms from "./locales/ms.json";
import th from "./locales/th.json";
import vi from "./locales/vi.json";
import sw from "./locales/sw.json";

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
  sl: { translation: sl },
  hu: { translation: hu },
  ro: { translation: ro },
  bg: { translation: bg },
  uk: { translation: uk },
  el: { translation: el },
  hr: { translation: hr },
  sr: { translation: sr },
  lt: { translation: lt },
  lv: { translation: lv },
  et: { translation: et },
  ka: { translation: ka },
  hy: { translation: hy },
  zh: { translation: zh },
  ja: { translation: ja },
  ko: { translation: ko },
  hi: { translation: hi },
  bn: { translation: bn },
  id: { translation: id },
  ms: { translation: ms },
  th: { translation: th },
  vi: { translation: vi },
  sw: { translation: sw },
} as const;

const LOADED_LANGUAGE_CODES =
  Object.keys(
    resources,
  ) as SupportedLanguageCode[];

function normalizeLanguageCode(
  value:
    | string
    | null
    | undefined,
): SupportedLanguageCode {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }

  const normalized =
    value.trim().toLowerCase();

  if (
    isSupportedLanguage(
      normalized,
    ) &&
    LOADED_LANGUAGE_CODES.includes(
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
    ) &&
    LOADED_LANGUAGE_CODES.includes(
      baseCode,
    )
  ) {
    return baseCode;
  }

  return DEFAULT_LANGUAGE;
}

function getDeviceLanguage():
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

async function getInitialLanguage():
  Promise<SupportedLanguageCode> {
  try {
    const savedLanguage =
      await AsyncStorage.getItem(
        LANGUAGE_STORAGE_KEY,
      );

    if (savedLanguage) {
      const normalized =
        normalizeLanguageCode(
          savedLanguage,
        );

      if (
        normalized ===
        savedLanguage
      ) {
        return normalized;
      }
    }
  } catch (error) {
    console.warn(
      "CREOVA: unable to read saved language.",
      error,
    );
  }

  return getDeviceLanguage();
}

export async function initializeI18n():
  Promise<void> {
  if (i18n.isInitialized) {
    return;
  }

  // i18next exposes these APIs on its default instance.
  // eslint-disable-next-line import/no-named-as-default-member
  await i18n
    .use(initReactI18next)
    .init({
      resources,

      lng:
        DEFAULT_LANGUAGE,

      fallbackLng:
        FALLBACK_LANGUAGE,

      compatibilityJSON:
        I18N_COMPATIBILITY,

      interpolation: {
        escapeValue: false,
      },

      returnNull: false,

      returnEmptyString: false,

      react: {
        useSuspense: false,
      },
    });

  const initialLanguage =
    await getInitialLanguage();

  // eslint-disable-next-line import/no-named-as-default-member
  await i18n.changeLanguage(
    initialLanguage,
  );

  applyRtlLayout(
    initialLanguage,
  );
}

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
    !LOADED_LANGUAGE_CODES.includes(
      languageCode,
    )
  ) {
    return false;
  }

  try {
    // eslint-disable-next-line import/no-named-as-default-member
    await i18n.changeLanguage(
      languageCode,
    );

    await AsyncStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      languageCode,
    );

    applyRtlLayout(
      languageCode,
    );

    return true;
  } catch (error) {
    console.error(
      "CREOVA: language change failed.",
      error,
    );

    return false;
  }
}

export function getCurrentLanguage():
  SupportedLanguageCode {
  return normalizeLanguageCode(
    i18n.language,
  );
}

export async function getStoredLanguage():
  Promise<
    SupportedLanguageCode | null
  > {
  try {
    const saved =
      await AsyncStorage.getItem(
        LANGUAGE_STORAGE_KEY,
      );

    if (!saved) {
      return null;
    }

    const normalized =
      normalizeLanguageCode(saved);

    return normalized === saved
      ? normalized
      : null;
  } catch {
    return null;
  }
}

export function isLanguageLoaded(
  languageCode: SupportedLanguageCode,
): boolean {
  return LOADED_LANGUAGE_CODES.includes(
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
  RTL_LANGUAGES,
  isRtlLanguage,
  getLanguageDirection,
} from "./rtl";

export default i18n;