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
import hu from "./locales/hu.json";
import ro from "./locales/ro.json";
import bg from "./locales/bg.json";
import uk from "./locales/uk.json";
import el from "./locales/el.json";
import hr from "./locales/hr.json";
import sr from "./locales/sr.json";
import sl from "./locales/sl.json";
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
  hu: { translation: hu },
  ro: { translation: ro },
  bg: { translation: bg },
  uk: { translation: uk },
  el: { translation: el },
  hr: { translation: hr },
  sr: { translation: sr },
  sl: { translation: sl },
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
