export const AI_CONFIG = {
  defaultProvider: "gemini",

  model: "gemini-3.8-flash",

  maxTokens: 4096,

  timeout: 60000,
} as const;

export const SUPABASE_TABLES = {
  profiles: "profiles",
  wallets: "wallets",
  coinTransactions: "coin_transactions",
  subscriptions: "subscriptions",
  generationHistory: "generation_history",
  adminRoles: "admin_roles",
} as const;

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
  },
  {
    code: "uz",
    name: "Uzbek",
    nativeName: "O'zbekcha",
  },
  {
    code: "ru",
    name: "Russian",
    nativeName: "Русский",
  },
  {
    code: "tr",
    name: "Turkish",
    nativeName: "Türkçe",
  },
  {
    code: "kk",
    name: "Kazakh",
    nativeName: "Қазақша",
  },
  {
    code: "ky",
    name: "Kyrgyz",
    nativeName: "Кыргызча",
  },
  {
    code: "tg",
    name: "Tajik",
    nativeName: "Тоҷикӣ",
  },
  {
    code: "az",
    name: "Azerbaijani",
    nativeName: "Azərbaycanca",
  },
  {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
  },
  {
    code: "fa",
    name: "Persian",
    nativeName: "فارسی",
  },
  {
    code: "he",
    name: "Hebrew",
    nativeName: "עברית",
  },
  {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
  },
  {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
  },
  {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
  },
  {
    code: "fr",
    name: "French",
    nativeName: "Français",
  },
  {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
  },
  {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
  },
  {
    code: "nl",
    name: "Dutch",
    nativeName: "Nederlands",
  },
  {
    code: "sv",
    name: "Swedish",
    nativeName: "Svenska",
  },
  {
    code: "no",
    name: "Norwegian",
    nativeName: "Norsk",
  },
  {
    code: "da",
    name: "Danish",
    nativeName: "Dansk",
  },
  {
    code: "fi",
    name: "Finnish",
    nativeName: "Suomi",
  },
  {
    code: "is",
    name: "Icelandic",
    nativeName: "Íslenska",
  },
  {
    code: "pl",
    name: "Polish",
    nativeName: "Polski",
  },
  {
    code: "cs",
    name: "Czech",
    nativeName: "Čeština",
  },
  {
    code: "sk",
    name: "Slovak",
    nativeName: "Slovenčina",
  },
  {
    code: "hu",
    name: "Hungarian",
    nativeName: "Magyar",
  },
  {
    code: "ro",
    name: "Romanian",
    nativeName: "Română",
  },
  {
    code: "bg",
    name: "Bulgarian",
    nativeName: "Български",
  },
  {
    code: "uk",
    name: "Ukrainian",
    nativeName: "Українська",
  },
  {
    code: "el",
    name: "Greek",
    nativeName: "Ελληνικά",
  },
  {
    code: "hr",
    name: "Croatian",
    nativeName: "Hrvatski",
  },
  {
    code: "sr",
    name: "Serbian",
    nativeName: "Српски",
  },
  {
    code: "sl",
    name: "Slovenian",
    nativeName: "Slovenščina",
  },
  {
    code: "lt",
    name: "Lithuanian",
    nativeName: "Lietuvių",
  },
  {
    code: "lv",
    name: "Latvian",
    nativeName: "Latviešu",
  },
  {
    code: "et",
    name: "Estonian",
    nativeName: "Eesti",
  },
  {
    code: "ka",
    name: "Georgian",
    nativeName: "ქართული",
  },
  {
    code: "hy",
    name: "Armenian",
    nativeName: "Հայերեն",
  },
  {
    code: "zh",
    name: "Chinese",
    nativeName: "中文",
  },
  {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
  },
  {
    code: "ko",
    name: "Korean",
    nativeName: "한국어",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
  },
  {
    code: "id",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
  },
  {
    code: "ms",
    name: "Malay",
    nativeName: "Bahasa Melayu",
  },
  {
    code: "th",
    name: "Thai",
    nativeName: "ไทย",
  },
  {
    code: "vi",
    name: "Vietnamese",
    nativeName: "Tiếng Việt",
  },
  {
    code: "sw",
    name: "Swahili",
    nativeName: "Kiswahili",
  },
];

export type SupportedLanguageCode =
  (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: SupportedLanguageCode =
  "en";
