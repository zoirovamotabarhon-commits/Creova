/**
 * CREOVA
 * Runtime translation of the AI Chat screen for languages that do not ship a
 * hand-written translation in aiChatStrings.ts (every other supported language).
 *
 * The English strings are translated once with the app's own AI (gemini-chat),
 * the answer is strictly validated (same keys, same {{placeholders}}, no empty
 * values) and cached on the device. If anything fails, the screen simply keeps
 * showing English. Invalid output is never installed.
 *
 * NOTE: machine translations - have a native speaker review important languages.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";

import { AI_CHAT_STRINGS } from "./aiChatStrings";

export type Bundle = Record<string, string>;
export type Translator = (prompt: string, systemPrompt: string) => Promise<string>;

const CACHE_PREFIX = "creova.aichat.i18n.v1";
const MAX_VALUE_LENGTH = 400;

const SYSTEM_PROMPT =
  "You are a professional software localization translator for a mobile app. " +
  "Translate the user's JSON of English UI strings into the requested language. " +
  "Rules: keep every JSON key exactly as it is; keep placeholders such as {{n}}, {{title}} and {{time}} " +
  "exactly as they are (do not translate or remove them); keep emoji; keep each translation short and natural " +
  "for a button or message in a mobile app; do not add explanations or markdown. " +
  "Output ONLY one valid JSON object.";

export function placeholdersOf(text: string): string {
  return (text.match(/\{\{\s*\w+\s*\}\}/g) ?? [])
    .map((token) => token.replace(/\s/g, ""))
    .sort()
    .join(",");
}

// Cache key changes whenever the English source changes.
export function sourceHash(source: Bundle): string {
  const text = Object.keys(source)
    .sort()
    .map((key) => `${key}=${source[key]}`)
    .join("\n");
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function buildPrompt(code: string, languageName: string, source: Bundle): string {
  return `Target language: ${languageName} (${code}).\n\n${JSON.stringify(source, null, 2)}`;
}

// Returns a clean bundle, or null if the model output cannot be trusted.
export function parseTranslation(raw: string, source: Bundle): Bundle | null {
  if (typeof raw !== "string") return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const input = parsed as Record<string, unknown>;
  const out: Bundle = {};
  for (const key of Object.keys(source)) {
    const value = input[key];
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (text.length === 0 || text.length > MAX_VALUE_LENGTH) return null;
    if (text.includes("**")) return null;
    if (placeholdersOf(text) !== placeholdersOf(source[key])) return null;
    out[key] = text;
  }
  return out;
}

function install(code: string, bundle: Bundle): void {
  i18n.addResourceBundle(code, "aiChat", bundle, true, true);
}

const inFlight = new Map<string, Promise<boolean>>();
const rejectedThisSession = new Set<string>();

// Returns true when a translation was installed (the screen should re-render).
export async function ensureAiChatTranslation(
  code: string,
  languageName: string,
  translate: Translator,
): Promise<boolean> {
  if (AI_CHAT_STRINGS[code]) return false; // hand-written translation (or English)
  if (!i18n.isInitialized) return false;

  const running = inFlight.get(code);
  if (running) return running;

  const job = (async () => {
    const source = AI_CHAT_STRINGS.en as Bundle;
    const cacheKey = `${CACHE_PREFIX}.${code}.${sourceHash(source)}`;

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = parseTranslation(cached, source);
        if (parsed) {
          install(code, parsed);
          return true;
        }
      }
    } catch {
      // cache unreadable: fall through and translate again
    }

    if (rejectedThisSession.has(code)) return false;

    try {
      const raw = await translate(buildPrompt(code, languageName, source), SYSTEM_PROMPT);
      const parsed = parseTranslation(raw, source);
      if (!parsed) {
        rejectedThisSession.add(code); // do not ask (and pay) again this session
        return false;
      }
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(parsed));
      } catch {
        // caching is best-effort
      }
      install(code, parsed);
      return true;
    } catch {
      return false; // offline / server busy: retried on the next trigger
    }
  })();

  inFlight.set(code, job);
  try {
    return await job;
  } finally {
    inFlight.delete(code);
  }
  }
