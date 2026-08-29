import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import { LANGUAGES } from "./languages";
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  I18N_COMPATIBILITY,
} from "./config";

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
};

const SUPPORTED_CODES = Object.keys(resources);

function resolveDeviceLanguage(): string {
  const deviceLanguageCode =
    Localization.getLocales()[0]?.languageCode ??
    DEFAULT_LANGUAGE;

  return SUPPORTED_CODES.includes(
    deviceLanguageCode
  )
    ? deviceLanguageCode
    : DEFAULT_LANGUAGE;
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: resolveDeviceLanguage(),
    fallbackLng: FALLBACK_LANGUAGE,
    compatibilityJSON: I18N_COMPATIBILITY,
    interpolation: {
      escapeValue: false,
    },
  });

export { LANGUAGES };
export default i18n;
