import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  Modal,
  AppState,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { invokeEdgeFunction } from "../services/edgeFunctions";
import { generateImage } from "../services/image";
import { generateVoice } from "../services/voice";
import { supabase } from "../services/supabase";
import {
  ChatCache,
  ChatMessage,
  ConversationSummary,
  cacheConversation,
  emptyCache,
  enqueueOps,
  fetchConversation,
  fetchConversationList,
  flushOutbox,
  fromCached,
  hasPendingOps,
  loadCache,
  loadOutbox,
  mergeConversationList,
  nextTimestamp,
  planSync,
  resolveMedia,
  saveCache,
  uuid,
} from "../services/chatHistory";
import { LANGUAGES } from "../i18n/languages";
import { AI_CHAT_STRINGS, registerAiChatStrings } from "../i18n/aiChatStrings";
import { ensureAiChatTranslation } from "../i18n/aiChatTranslate";

type Message = ChatMessage;

interface Req {
  text: string;
  imageUri?: string;
  imageBase64?: string | null;
  voice?: { uri: string; durationMs: number };
  forceImage?: boolean;
}

function buildSystemPrompt(uiLanguage: string): string {
  return (
    "You are Creova AI, the smart assistant inside the Creova app. " +
    "Always reply in the same language and script the user writes in " +
    "(for example Uzbek in Latin letters if they write that way). " +
    `If the user's language is unclear, use ${uiLanguage}. ` +
    "Be natural, friendly and accurate. " +
    "You can analyze images the user attaches and listen to voice messages they send; " +
    "when the user asks you to draw or create a picture, the app generates the image for them. " +
    "If a picture is requested but the description is too vague, ask what they want. " +
    "Never say that you are only a text model. " +
    "Write plain text only: do not use markdown symbols such as ** or #; use a hyphen (-) for lists. " +
    "If you do not know something, say so instead of making it up."
  );
}

const HISTORY_LIMIT = 30;

// React qoidasi komponent ichida Date.now() ni to'g'ridan-to'g'ri chaqirishni taqiqlaydi
const nowMs = (): number => Date.now();

const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDate = (ts: number) =>
  new Date(ts).toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

// Yuborilgan matnli xabarni tahrirlash mumkinmi (rasm/ovozli xabar va xato xabarlari emas)
function isEditable(m: Message): boolean {
  return m.sender === "user" && !m.attachment && !m.isError && m.text.trim().length > 0;
}

// Tahrirlanayotgan xabar va undan keyingi hamma xabar olib tashlanadi (yangi javob olinadi)
function messagesBeforeEdit(msgs: Message[], id: string): Message[] | null {
  const idx = msgs.findIndex((m) => m.id === id);
  if (idx === -1 || !isEditable(msgs[idx])) return null;
  return msgs.slice(0, idx);
}

// Rasm yaratish so'rovini tanib olish (o'zbekcha, inglizcha, ruscha)
function isImageRequest(rawText: string): boolean {
  const text = rawText.toLowerCase().replace(/['’‘`ʻʼ]/g, "");
  if (!text.trim()) return false;

  // O'zbekcha: "rasm chizib ber", "mushuk rasmini yarat", "surat yasab ber", "logo tayyorla"
  if (
    /(rasm|surat|tasvir|logo|illustratsiya)\w*(\s+\S+){0,4}?\s+(chiz|yarat|yasa|tayyorla|generatsiya)\w*/.test(
      text,
    )
  ) {
    return true;
  }
  // "chizib ber", "chizib bering"
  if (/\bchiz\w*\s+ber/.test(text)) return true;

  // Inglizcha
  if (
    /\b(generate|create|make|draw|paint)\b.{0,30}\b(image|picture|photo|drawing|logo|illustration)\b/.test(
      text,
    )
  ) {
    return true;
  }
  if (/\bdraw\s+(me|a|an|the)\b/.test(text)) return true;

  // Ruscha
  if (/нарису/.test(text)) return true;
  if (
    /(сгенерируй|создай|сделай).{0,30}(рисунок|картинк|изображени|фото|логотип)/.test(
      text,
    )
  ) {
    return true;
  }

  return false;
}

type ErrorKey =
  | "errBusy"
  | "errSession"
  | "errCoins"
  | "errPlanLimit"
  | "errRateLimit"
  | "errTooLarge"
  | "errNetwork"
  | "errTimeout"
  | "errUnknown";

interface FriendlyError {
  key: ErrorKey;
  detail: string;
  retryable: boolean;
}

// Texnik xatoni tarjima kalitiga aylantiradi (matn ekranda foydalanuvchi tilida chiqadi)
function describeError(err: any): FriendlyError {
  const status: number | undefined = typeof err?.status === "number" ? err.status : undefined;
  const raw = String(err?.message ?? err ?? "").trim();
  const lower = raw.toLowerCase();
  const name = String(err?.name ?? "");
  const detail = raw.replace(/\s+/g, " ").slice(0, 140);
  const make = (key: ErrorKey, retryable: boolean): FriendlyError => ({ key, detail, retryable });

  if (lower.includes("timeout_client")) return make("errTimeout", true);
  if (
    /all models failed|high demand|overloaded|unavailable/.test(lower) ||
    status === 502 ||
    status === 503 ||
    status === 504
  ) {
    return make("errBusy", true);
  }
  if (status === 401 || /jwt|authentication required|invalid or expired|not authenticated/.test(lower)) {
    return make("errSession", false);
  }
  if (/insufficient|not enough|coin|balance/.test(lower)) return make("errCoins", false);
  // Tarif limiti: "The image limit (5) for the free plan has been reached."
  if (/limit.*reached|has been reached|monthly|\bplan\b/.test(lower)) return make("errPlanLimit", false);
  if (status === 429 || /rate limit|too many|quota/.test(lower)) return make("errRateLimit", true);
  if (status === 413 || /too large|payload/.test(lower)) return make("errTooLarge", false);
  if (status === 404) return make("errUnknown", false);
  if (
    name === "FunctionsFetchError" ||
    (!status && /network|failed to fetch|fetch failed|offline|connection/.test(lower))
  ) {
    return make("errNetwork", true);
  }
  return make("errUnknown", true);
}

// Faqat vaqtinchalik xatolarda (tarmoq, 502/503/504) bir marta avtomatik qayta uriniladi
function isTransient(err: any): boolean {
  const status: number | undefined = typeof err?.status === "number" ? err.status : undefined;
  const lower = String(err?.message ?? "").toLowerCase();
  const name = String(err?.name ?? "");
  if (status === 502 || status === 503 || status === 504) return true;
  if (name === "FunctionsFetchError" || name === "FunctionsRelayError") return true;
  return !status && /network request failed|failed to fetch|fetch failed/.test(lower);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout_client")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function callFunction(name: string, body: Record<string, unknown>): Promise<any> {
  let lastError: any = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await withTimeout(invokeEdgeFunction<any>(name, { body }), 60000);
      if (!result.error) {
        const data = result.data;
        if (data && data.success === false) {
          throw new Error(String(data.error || "Request failed"));
        }
        return data;
      }
      lastError = result.error;
    } catch (e) {
      lastError = e;
    }
    if (!isTransient(lastError)) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw lastError;
}

async function uriToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the audio file."));
    reader.readAsDataURL(blob);
  });
  const mimeType =
    blob.type && blob.type.startsWith("audio/")
      ? blob.type
      : Platform.OS === "web"
        ? "audio/webm"
        : "audio/mp4";
  return { base64: dataUrl.split(",")[1] ?? "", mimeType };
}

function VoicePlayer({ uri, durationMs }: { uri: string; durationMs?: number }) {
  const { t } = useTranslation("aiChat");
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const toggle = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      if (status.duration > 0 && status.currentTime >= status.duration - 0.05) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      Alert.alert(t("errorTitle"), t("somethingWrong"));
    }
  };

  const shownMs = status.playing
    ? status.currentTime * 1000
    : durationMs ?? status.duration * 1000;

  return (
    <TouchableOpacity style={styles.voiceRow} onPress={toggle}>
      <Text style={styles.voiceIcon}>{status.playing ? "⏸" : "▶️"}</Text>
      <View style={styles.voiceBar} />
      <Text style={styles.voiceTime}>{formatDuration(shownMs)}</Text>
    </TouchableOpacity>
  );
}

export default function AIChatScreen() {
  registerAiChatStrings(); // "aiChat" tarjimalarini i18n'ga qo'shadi (bir marta)
  const { t, i18n } = useTranslation("aiChat");
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageMode, setImageMode] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [offline, setOffline] = useState(false);
  const [ttsId, setTtsId] = useState<string | null>(null);
  const [loadingConv, setLoadingConv] = useState(false);
  const [, setLangVersion] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const messagesRef = useRef<Message[]>([]);
  const lastReqRef = useRef<Req | null>(null);
  const busyRef = useRef(false);
  const readyRef = useRef(false);
  const mountedRef = useRef(true);
  const convIdRef = useRef<string | null>(null);
  const knownRef = useRef<string[]>([]); // ids the cloud has (or will have) for the open chat
  const cacheRef = useRef<ChatCache>(emptyCache());
  const userIdRef = useRef<string | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const versionRef = useRef(0); // changes whenever the user changes the open chat
  const flushingRef = useRef(false);
  const flushAgainRef = useRef(false);
  const retryRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; delay: number }>({
    timer: null,
    delay: 5000,
  });

  // Saqlash ishlari navbat bilan bajariladi (tartib buzilmasligi uchun). Xato chatni to'xtatmaydi.
  const queue = (job: () => Promise<void>) => {
    chainRef.current = chainRef.current
      .then(job)
      .catch((e) => console.warn("Chat sync error:", e));
  };

  // Navbatdagi operatsiyalarni bulutga yuboradi; internet yo'q bo'lsa, keyinroq qayta uriniladi
  const flush = async (): Promise<void> => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (flushingRef.current) {
      flushAgainRef.current = true;
      return;
    }
    flushingRef.current = true;
    try {
      do {
        flushAgainRef.current = false;
        const result = await flushOutbox(uid);
        if (!mountedRef.current) return;
        setPendingCount(result.remaining);
        if (result.failed) {
          if (!retryRef.current.timer) {
            const delay = retryRef.current.delay;
            retryRef.current.delay = Math.min(delay * 2, 120000);
            retryRef.current.timer = setTimeout(() => {
              retryRef.current.timer = null;
              void flush();
            }, delay);
          }
        } else {
          retryRef.current.delay = 5000;
        }
      } while (flushAgainRef.current);
    } finally {
      flushingRef.current = false;
    }
  };

  // Ekrandagi xabarlarni bulutdagi holat bilan solishtirib, kerakli operatsiyalarni navbatga qo'yadi
  const syncNow = (dirtyIds: string[] = []) => {
    const uid = userIdRef.current;
    if (!uid) return;
    const msgs = messagesRef.current;
    const hasClean = msgs.some((m) => !m.isError);
    if (!hasClean && knownRef.current.length === 0) return;
    if (!convIdRef.current) convIdRef.current = uuid();
    const convId = convIdRef.current;

    const existing = cacheRef.current.conversations.find((c) => c.id === convId);
    // Bo'sh sarlavha "noma'lum" degani: yangi sarlavha birinchi xabardan olinadi
    const existingTitle = existing && existing.title ? existing.title : undefined;
    const knownBefore = knownRef.current;
    const plan = planSync(convId, msgs, knownBefore, dirtyIds, existingTitle);
    knownRef.current = plan.known;

    cacheConversation(
      cacheRef.current,
      convId,
      msgs,
      nowMs(),
      knownBefore.length === 0 && existingTitle !== undefined ? existingTitle : undefined,
    );
    cacheRef.current.activeId = convId;
    setConversations([...cacheRef.current.conversations]);

    const ops = plan.ops;
    queue(async () => {
      if (ops.length > 0) {
        const all = await enqueueOps(uid, ops); // avval navbatga (bardoshli), keyin keshga
        if (mountedRef.current) setPendingCount(all.length);
      }
      await saveCache(uid, cacheRef.current);
      if (ops.length > 0) void flush();
    });
  };

  // Xabarlar ro'yxatini yangilaydi va bulutga saqlashni boshlaydi
  const commit = (updater: (prev: Message[]) => Message[], dirtyIds?: string[]) => {
    messagesRef.current = updater(messagesRef.current);
    versionRef.current += 1;
    setMessages(messagesRef.current);
    syncNow(dirtyIds);
  };

  // Ochiq suhbatdagi rasm/ovoz fayllari uchun yangi (vaqtinchalik) havolalar olinadi
  const resolveActiveMedia = async (uid: string) => {
    const convId = convIdRef.current;
    const version = versionRef.current;
    const resolved = await resolveMedia(uid, messagesRef.current);
    if (!mountedRef.current || convIdRef.current !== convId || versionRef.current !== version) return;
    if (resolved.some((m, i) => m !== messagesRef.current[i])) {
      messagesRef.current = resolved;
      setMessages(resolved);
    }
  };

  // Suhbatni buluttan o'qiydi (boshqa qurilmadagi o'zgarishlar ham ko'rinadi)
  const loadFromCloud = async (uid: string, convId: string) => {
    const version = versionRef.current;
    const res = await fetchConversation(convId);
    if (!mountedRef.current) return;
    if (res.status === "error") {
      setOffline(true);
      return;
    }
    setOffline(false);
    if (res.status === "missing") return;
    const stale = () =>
      convIdRef.current !== convId || versionRef.current !== version || busyRef.current;
    if (stale()) return;
    const resolved = await resolveMedia(uid, res.messages);
    if (!mountedRef.current || stale()) return;
    messagesRef.current = resolved;
    knownRef.current = resolved.map((m) => m.id);
    setMessages(resolved);
    const summary = cacheRef.current.conversations.find((c) => c.id === convId);
    cacheConversation(cacheRef.current, convId, resolved, summary?.updatedAt ?? nowMs(), res.title);
    setConversations([...cacheRef.current.conversations]);
  };

  // Suhbatlar ro'yxatini buluttan yangilaydi
  const refreshFromCloud = async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const list = await fetchConversationList();
    if (!mountedRef.current) return;
    if (!list) {
      setOffline(true);
      return;
    }
    setOffline(false);
    const ops = await loadOutbox(uid);
    cacheRef.current.conversations = mergeConversationList(
      list,
      cacheRef.current.conversations,
      ops,
    );
    setConversations([...cacheRef.current.conversations]);
    const activeId = convIdRef.current;
    if (activeId && !hasPendingOps(ops, activeId) && list.some((c) => c.id === activeId)) {
      await loadFromCloud(uid, activeId);
    }
    await saveCache(uid, cacheRef.current);
  };

  // Ilova ochilganda: kesh bilan darrov ko'rsatiladi, so'ng bulut bilan solishtiriladi
  useEffect(() => {
    let cancelled = false;
    const retry = retryRef.current; // bir xil obyekt; cleanup'da ishlatish uchun nusxa
    mountedRef.current = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id ?? null;
        userIdRef.current = uid;
        if (uid) {
          cacheRef.current = await loadCache(uid);
          setConversations([...cacheRef.current.conversations]);
          const active = cacheRef.current.conversations.find(
            (c) => c.id === cacheRef.current.activeId,
          );
          if (active?.messages && !cancelled) {
            const restored = active.messages.map(fromCached);
            convIdRef.current = active.id;
            knownRef.current = restored.map((m) => m.id);
            messagesRef.current = restored;
            setMessages(restored);
            void resolveActiveMedia(uid);
          }
          const ops = await loadOutbox(uid);
          if (!cancelled) setPendingCount(ops.length);
        }
      } catch (e) {
        console.warn("Could not load chat history:", e);
      } finally {
        readyRef.current = true;
        if (!cancelled) setReady(true);
      }
      if (!cancelled && userIdRef.current) {
        await flush();
        await refreshFromCloud();
      }
    })();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void flush();
        void refreshFromCloud();
      }
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      subscription.remove();
      if (retry.timer) clearTimeout(retry.timer);
    };
    // Faqat ilova ochilganda ishlaydi (flush/refreshFromCloud har renderda qayta yaratiladi)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tarjimasi yo'q tillar uchun chat matnlari bir marta AI bilan tarjima qilinadi (keshlanadi)
  useEffect(() => {
    const code = i18n.language;
    if (!code || AI_CHAT_STRINGS[code]) return;
    let cancelled = false;
    const name = LANGUAGES.find((l) => l.code === code)?.name ?? code;
    void ensureAiChatTranslation(code, name, async (prompt, systemPrompt) => {
      const data = await callFunction("gemini-chat", {
        prompt,
        message: prompt,
        systemPrompt,
        max_tokens: 4096,
      });
      return String(data?.text ?? "");
    }).then((installed) => {
      if (installed && !cancelled) setLangVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  const convTitle = (c: ConversationSummary): string => {
    if (c.title) return c.title;
    const first = c.messages?.find((m) => m.sender === "user");
    if (first?.attachment === "voice") return t("voiceMessage");
    if (first?.attachment === "image") return t("photo");
    return t("newChatTitle");
  };

  const resetEdit = () => {
    if (editingId) {
      setEditingId(null);
      setInput("");
    }
  };

  const startNewChat = () => {
    if (busyRef.current) return;
    resetEdit();
    setImageMode(false);
    versionRef.current += 1;
    convIdRef.current = null;
    knownRef.current = [];
    lastReqRef.current = null;
    messagesRef.current = [];
    setMessages([]);
    setHistoryOpen(false);
    cacheRef.current.activeId = null;
    const uid = userIdRef.current;
    if (uid) queue(() => saveCache(uid, cacheRef.current));
  };

  const openConversation = async (id: string) => {
    if (busyRef.current) return;
    const summary = cacheRef.current.conversations.find((c) => c.id === id);
    if (!summary) return;
    resetEdit();
    setImageMode(false);
    setHistoryOpen(false);
    versionRef.current += 1;
    const restored = summary.messages ? summary.messages.map(fromCached) : [];
    convIdRef.current = id;
    lastReqRef.current = null;
    knownRef.current = restored.map((m) => m.id);
    messagesRef.current = restored;
    setMessages(restored);
    cacheRef.current.activeId = id;

    const uid = userIdRef.current;
    if (!uid) return;
    setLoadingConv(!summary.messages);
    queue(() => saveCache(uid, cacheRef.current));
    void resolveActiveMedia(uid);
    const ops = await loadOutbox(uid);
    if (!hasPendingOps(ops, id)) await loadFromCloud(uid, id);
    if (mountedRef.current) setLoadingConv(false);
  };

  const confirmDelete = (conv: ConversationSummary) => {
    if (busyRef.current) return;
    Alert.alert(t("deleteTitle"), t("deleteMessage", { title: convTitle(conv) }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: () => {
          const uid = userIdRef.current;
          if (convIdRef.current === conv.id) {
            resetEdit();
            versionRef.current += 1;
            convIdRef.current = null;
            knownRef.current = [];
            lastReqRef.current = null;
            messagesRef.current = [];
            setMessages([]);
            cacheRef.current.activeId = null;
          }
          cacheRef.current.conversations = cacheRef.current.conversations.filter(
            (c) => c.id !== conv.id,
          );
          setConversations([...cacheRef.current.conversations]);
          if (uid) {
            queue(async () => {
              const all = await enqueueOps(uid, [
                { opId: uuid(), type: "delete", conversationId: conv.id },
              ]);
              if (mountedRef.current) setPendingCount(all.length);
              await saveCache(uid, cacheRef.current);
              void flush();
            });
          }
        },
      },
    ]);
  };

  // AI javobini ovoz bilan o'qib berish (bir marta tayyorlanadi, keyin bepul qayta eshitiladi)
  const listen = async (m: Message) => {
    if (busyRef.current || ttsId || !m.text.trim()) return;
    const uid = userIdRef.current;
    busyRef.current = true;
    setTtsId(m.id);
    try {
      const res = await withTimeout(generateVoice(m.text), 180000);
      if (!res.success || !res.audioUrl || !res.generationId) {
        throw new Error(res.error || "Voice generation failed.");
      }
      const audioPath = uid ? `${uid}/${res.generationId}.wav` : undefined;
      commit(
        (prev) =>
          prev.map((x) => (x.id === m.id ? { ...x, audioUri: res.audioUrl, audioPath } : x)),
        [m.id],
      );
    } catch (err: any) {
      console.warn("AI voice error:", err);
      Alert.alert(t("errorTitle"), t(describeError(err).key));
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setTtsId(null);
    }
  };

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Klaviatura yopiq bo'lsa, panel navigatsiya tugmalaridan yuqorida turadi
  const bottomPad = keyboardVisible ? 10 : insets.bottom + 16;

  const applyAsset = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
      setSelectedBase64(result.assets[0].base64 ?? null);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setSelectedBase64(null);
  };

  // Telefon xotirasi (galereya) yoki kompyuter (web'da fayl tanlash oynasi)
  const pickFromGallery = async () => {
    setShowAttach(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });
      applyAsset(result);
    } catch {
      Alert.alert(t("errorTitle"), t("somethingWrong"));
    }
  };

  // Kameradan surat olish
  const takePhoto = async () => {
    setShowAttach(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("permissionNeeded"), t("cameraPermission"));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.5,
        base64: true,
      });
      applyAsset(result);
    } catch {
      Alert.alert(t("errorTitle"), t("somethingWrong"));
    }
  };

  const startRecording = async () => {
    try {
      setShowAttach(false);
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("permissionNeeded"), t("micPermission"));
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch {
      Alert.alert(t("errorTitle"), t("somethingWrong"));
    }
  };

  const stopAndReset = async () => {
    try {
      await recorder.stop();
    } catch {}
    setIsRecording(false);
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
  };

  const cancelRecording = async () => {
    await stopAndReset();
  };

  const finishRecording = async () => {
    const durationMs = recorderState.durationMillis ?? 0;
    await stopAndReset();
    const uri = recorder.uri;
    if (!uri || durationMs < 700) return; // juda qisqa yozuv yuborilmaydi
    await run({ text: "", voice: { uri, durationMs } }, true);
  };

  const startEdit = (m: Message) => {
    if (busyRef.current || isRecording || !isEditable(m)) return;
    setEditingId(m.id);
    setImageMode(false);
    setShowAttach(false);
    clearImage();
    setInput(m.text);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setInput("");
  };

  const submit = async () => {
    const text = input.trim();
    if (!text && !selectedImage) return;
    if (!readyRef.current || busyRef.current) return;

    // Tahrirlash: eski xabar va undan keyingi javoblar olib tashlanadi, yangi matn qayta yuboriladi
    if (editingId) {
      const kept = messagesBeforeEdit(messagesRef.current, editingId);
      if (kept) commit(() => kept);
      setEditingId(null);
    }

    const req: Req = {
      text,
      imageUri: selectedImage || undefined,
      imageBase64: selectedBase64,
      forceImage: imageMode && !selectedImage,
    };
    setInput("");
    setImageMode(false);
    clearImage();
    await run(req, true);
  };

  const retry = async () => {
    const req = lastReqRef.current;
    if (!req || busyRef.current) return;
    if (editingId) cancelEdit();
    // Oxirgi xato xabarini olib tashlab, o'sha so'rovni qayta yuboramiz
    commit((prev) => (prev.length && prev[prev.length - 1].isError ? prev.slice(0, -1) : prev));
    await run(req, false);
  };

  const run = async (req: Req, addBubble: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    lastReqRef.current = req;
    setLoading(true);

    const voice = req.voice;
    const text = req.text;
    const hasImage = !voice && !!req.imageUri;
    const uiLanguage = LANGUAGES.find((l) => l.code === i18n.language)?.name ?? "English";

    // Tarix: joriy xabardan oldingi suhbat (xato xabarlarsiz)
    const base = addBubble ? messagesRef.current : messagesRef.current.slice(0, -1);
    const history = base
      .filter((m) => !m.isError)
      .slice(-HISTORY_LIMIT)
      .map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        text:
          m.text ||
          (m.attachment === "voice" ? "[voice message]" : m.attachment === "image" ? "[image]" : ""),
      }))
      .filter((m) => m.text.trim().length > 0);

    if (addBubble) {
      const userMsg: Message = {
        id: uuid(),
        sender: "user",
        text,
        createdAt: nextTimestamp(),
        imageUri: hasImage ? req.imageUri : undefined,
        audioUri: voice?.uri,
        audioDurationMs: voice?.durationMs,
        mediaMime: voice
          ? Platform.OS === "web"
            ? "audio/webm"
            : "audio/mp4"
          : hasImage
            ? "image/jpeg" // foydalanuvchi rasmi ham bulutga yuklanadi
            : undefined,
        attachment: voice ? "voice" : hasImage ? "image" : undefined,
      };
      commit((prev) => [...prev, userMsg]);
    }

    try {
      // 1) Rasm yaratish: "Rasm yaratish" tugmasi (istalgan til) yoki tanilgan ibora
      if (!voice && !hasImage && (req.forceImage || isImageRequest(text))) {
        const result = await withTimeout(generateImage(text), 120000);
        if (!result.success || !result.imageUrl) {
          throw new Error(result.error || "Image generation failed.");
        }
        const imageMsg: Message = {
          id: uuid(),
          sender: "ai",
          text: "",
          createdAt: nextTimestamp(),
          imageUri: result.imageUrl,
          attachment: "image",
          generationId: result.generationId,
        };
        commit((prev) => [...prev, imageMsg]);
        return;
      }

      // 2) Ovozli xabar / rasm tahlili / oddiy suhbat
      let endpoint = "gemini-chat";
      let body: Record<string, unknown>;

      if (voice) {
        const { base64, mimeType } = await uriToBase64(voice.uri);
        body = {
          prompt:
            "The user sent a voice message. Listen to it carefully and reply in the language they spoke.",
          audioBase64: base64,
          audioMimeType: mimeType,
          systemPrompt: buildSystemPrompt(uiLanguage),
          history,
        };
      } else if (hasImage) {
        endpoint = "vision-analyze";
        const visionPrompt = text
          ? `${text}\n\n(Reply in the language of the message above, in plain text without markdown symbols such as ** or #.)`
          : `Describe in detail what is in this image. Reply in ${uiLanguage}, in plain text without markdown symbols such as ** or #.`;
        body = {
          prompt: visionPrompt,
          message: visionPrompt,
          imageBase64: req.imageBase64,
          mimeType: "image/jpeg",
        };
      } else {
        body = {
          prompt: text,
          message: text,
          systemPrompt: buildSystemPrompt(uiLanguage),
          history,
        };
      }

      const data = await callFunction(endpoint, body);
      const answer = String(data?.text || data?.description || data?.message || "").trim();
      if (!answer) {
        throw new Error("AI returned an empty response.");
      }

      const aiMsg: Message = {
        id: uuid(),
        sender: "ai",
        text: answer,
        createdAt: nextTimestamp(),
      };
      commit((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.warn("AI chat error:", err);
      const friendly = describeError(err);
      const errorMsg: Message = {
        id: uuid(),
        sender: "ai",
        text: "",
        createdAt: nextTimestamp(),
        errorKey: friendly.key,
        detail: friendly.detail,
        isError: true,
        retryable: friendly.retryable,
      };
      commit((prev) => [...prev, errorMsg]);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  const hasContent = input.trim().length > 0 || !!selectedImage;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => setHistoryOpen(true)}>
          <Text style={styles.headerButtonText}>☰ {t("history")}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CREOVA AI</Text>
        <TouchableOpacity style={styles.headerButton} onPress={startNewChat} disabled={loading}>
          <Text style={styles.headerButtonText}>＋ {t("newChat")}</Text>
        </TouchableOpacity>
      </View>

      {pendingCount > 0 ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>⟳ {t("syncPending")}</Text>
        </View>
      ) : offline ? (
        <View style={styles.syncBanner}>
          <Text style={styles.syncBannerText}>{t("offlineNotice")}</Text>
        </View>
      ) : null}

      {!ready || loadingConv ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#94a3b8" />
        </View>
      ) : (
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.sender === "user" ? styles.userBubble : styles.aiBubble,
              item.id === editingId && styles.bubbleEditing,
            ]}
          >
            <Text style={styles.senderText}>
              {item.sender === "user" ? t("chat.you", { ns: "translation" }) : "CREOVA AI"}
            </Text>

            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.messageImage} resizeMode="cover" />
            ) : null}

            {!item.imageUri && item.attachment === "image" ? (
              <Text style={styles.chipText}>🖼 {t("photo")}</Text>
            ) : null}

            {item.audioUri ? (
              <VoicePlayer uri={item.audioUri} durationMs={item.audioDurationMs} />
            ) : item.attachment === "voice" ? (
              <Text style={styles.chipText}>
                🎤 {t("voiceMessage")}
                {item.audioDurationMs ? ` ${formatDuration(item.audioDurationMs)}` : ""}
              </Text>
            ) : null}

            {item.errorKey || item.text ? (
              <Text style={styles.messageText} selectable>
                {item.errorKey ? t(item.errorKey) : item.text}
              </Text>
            ) : null}

            {__DEV__ && item.isError && item.detail ? (
              <Text style={styles.detailText} numberOfLines={3}>
                {item.detail}
              </Text>
            ) : null}

            {item.isError && item.retryable && item.id === messages[messages.length - 1]?.id ? (
              <TouchableOpacity style={styles.retryButton} onPress={retry} disabled={loading}>
                <Text style={styles.retryButtonText}>↻ {t("retry")}</Text>
              </TouchableOpacity>
            ) : null}

            {item.sender === "ai" &&
            item.text &&
            !item.isError &&
            !item.attachment &&
            !item.audioUri &&
            !item.audioPath ? (
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => listen(item)}
                disabled={!!ttsId || loading}
              >
                <Text style={styles.editButtonText}>
                  {ttsId === item.id ? `⏳ ${t("preparingAudio")}` : `🔊 ${t("listen")}`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {isEditable(item) && !loading && !isRecording ? (
              <TouchableOpacity style={styles.editButton} onPress={() => startEdit(item)}>
                <Text style={styles.editButtonText}>✎ {t("edit")}</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
          </View>
        )}
      />
      )}

      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          <TouchableOpacity onPress={clearImage} style={styles.removePreview}>
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {showAttach && !isRecording && (
        <View style={styles.attachMenu}>
          <TouchableOpacity style={styles.attachOption} onPress={pickFromGallery}>
            <Text style={styles.attachOptionText}>🖼  {t("gallery")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={takePhoto}>
            <Text style={styles.attachOptionText}>📷  {t("camera")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.attachOption}
            onPress={() => {
              if (editingId) cancelEdit();
              setImageMode(true);
              setShowAttach(false);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
          >
            <Text style={styles.attachOptionText}>🎨  {t("imageMode")}</Text>
          </TouchableOpacity>
        </View>
      )}

      {editingId ? (
        <View style={styles.modeBanner}>
          <Text style={styles.modeBannerText}>✎ {t("editing")}</Text>
          <TouchableOpacity onPress={cancelEdit}>
            <Text style={styles.modeBannerClose}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : imageMode ? (
        <View style={styles.modeBanner}>
          <Text style={styles.modeBannerText}>🎨 {t("imageModeBanner")}</Text>
          <TouchableOpacity onPress={() => setImageMode(false)}>
            <Text style={styles.modeBannerClose}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isRecording ? (
        <View style={[styles.inputContainer, { paddingBottom: bottomPad }]}>
          <TouchableOpacity style={styles.attachButton} onPress={cancelRecording}>
            <Text style={styles.attachButtonText}>🗑</Text>
          </TouchableOpacity>
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingDot}>●</Text>
            <Text style={styles.recordingText}>
              {t("recording", { time: formatDuration(recorderState.durationMillis ?? 0) })}
            </Text>
          </View>
          <TouchableOpacity style={styles.sendButton} onPress={finishRecording}>
            <Text style={styles.sendButtonText}>{t("send")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputContainer, { paddingBottom: bottomPad }]}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowAttach((v) => !v)}
            disabled={loading}
          >
            <Text style={styles.attachButtonText}>📎</Text>
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={t("chat.placeholder", { ns: "translation" })}
            placeholderTextColor="#888"
            value={input}
            onChangeText={setInput}
            editable={!loading}
            multiline
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
            textAlignVertical="top"
          />

          {hasContent || loading ? (
            <TouchableOpacity
              style={[styles.sendButton, loading && styles.disabledButton]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendButtonText}>{t("send")}</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={startRecording}>
              <Text style={styles.sendButtonText}>🎤</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={historyOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHistoryOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("historyTitle")}</Text>
              <TouchableOpacity onPress={() => setHistoryOpen(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {conversations.length === 0 ? (
              <Text style={styles.emptyText}>{t("historyEmpty")}</Text>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={(c) => c.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.convRow, item.id === convIdRef.current && styles.convRowActive]}
                    onPress={() => openConversation(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.convTitle} numberOfLines={1}>
                        {convTitle(item)}
                      </Text>
                      <Text style={styles.convMeta}>
                        {formatDate(item.updatedAt)}
                        {item.messageCount > 0
                          ? ` · ${t("messageCount", { n: item.messageCount })}`
                          : ""}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.convDelete} onPress={() => confirmDelete(item)}>
                      <Text style={styles.convDeleteText}>🗑</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1120" },
  listContainer: { padding: 12, paddingBottom: 20 },
  bubble: { padding: 12, borderRadius: 12, marginVertical: 6, maxWidth: "85%" },
  userBubble: { backgroundColor: "#1d4ed8", alignSelf: "flex-end" },
  aiBubble: { backgroundColor: "#1e293b", alignSelf: "flex-start" },
  senderText: { color: "#94a3b8", fontSize: 11, marginBottom: 4, fontWeight: "bold" },
  messageImage: { width: 220, height: 220, borderRadius: 8, marginBottom: 8 },
  messageText: { color: "#f8fafc", fontSize: 15 },
  timeText: { color: "#64748b", fontSize: 10, alignSelf: "flex-end", marginTop: 4 },
  previewContainer: { padding: 8, backgroundColor: "#0f172a", flexDirection: "row", alignItems: "center" },
  previewImage: { width: 50, height: 50, borderRadius: 6 },
  removePreview: { position: "absolute", top: 4, left: 50, backgroundColor: "red", width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  attachMenu: { backgroundColor: "#0f172a", paddingHorizontal: 10, paddingTop: 8, flexDirection: "row", flexWrap: "wrap" },
  attachOption: { backgroundColor: "#1e293b", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginRight: 8, marginBottom: 8 },
  attachOptionText: { color: "#f8fafc", fontSize: 14 },
  inputContainer: { flexDirection: "row", alignItems: "flex-end", paddingTop: 10, paddingHorizontal: 10, backgroundColor: "#0f172a" },
  attachButton: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: "center", alignItems: "center", marginRight: 6 },
  attachButtonText: { fontSize: 20 },
  input: { flex: 1, backgroundColor: "#1e293b", color: "#fff", paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12, borderRadius: 8, marginRight: 8, fontSize: 15, minHeight: 46, maxHeight: 140 },
  sendButton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, justifyContent: "center", alignItems: "center", minHeight: 46 },
  disabledButton: { backgroundColor: "#475569" },
  sendButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  recordingInfo: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#1e293b", borderRadius: 8, paddingHorizontal: 12, minHeight: 46, marginRight: 8 },
  recordingDot: { color: "#ef4444", fontSize: 16, marginRight: 8 },
  recordingText: { color: "#f8fafc", fontSize: 15 },
  voiceRow: { flexDirection: "row", alignItems: "center", minWidth: 180, paddingVertical: 4 },
  voiceIcon: { fontSize: 20, marginRight: 8 },
  voiceBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "#93c5fd", marginRight: 8 },
  voiceTime: { color: "#e2e8f0", fontSize: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#0f172a" },
  headerTitle: { color: "#f8fafc", fontWeight: "bold", fontSize: 16 },
  headerButton: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#1e293b" },
  headerButtonText: { color: "#f8fafc", fontSize: 13 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  chipText: { color: "#cbd5e1", fontSize: 13, marginBottom: 6, fontStyle: "italic" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#0f172a", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "75%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { color: "#f8fafc", fontSize: 16, fontWeight: "bold" },
  modalClose: { color: "#94a3b8", fontSize: 18, paddingHorizontal: 6 },
  emptyText: { color: "#94a3b8", fontSize: 14, paddingVertical: 16, textAlign: "center" },
  convRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1e293b", borderRadius: 10, padding: 12, marginBottom: 8 },
  convRowActive: { borderWidth: 1, borderColor: "#2563eb" },
  convTitle: { color: "#f8fafc", fontSize: 14, fontWeight: "bold" },
  convMeta: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  convDelete: { paddingHorizontal: 10, paddingVertical: 6 },
  convDeleteText: { fontSize: 18 },
  bubbleEditing: { borderWidth: 1, borderColor: "#f59e0b" },
  editButton: { alignSelf: "flex-start", marginTop: 6, paddingVertical: 4 },
  editButtonText: { color: "#bfdbfe", fontSize: 12 },
  modeBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#1e293b", paddingHorizontal: 12, paddingVertical: 8 },
  modeBannerText: { color: "#fcd34d", fontSize: 13, flex: 1 },
  modeBannerClose: { color: "#94a3b8", fontSize: 16, paddingHorizontal: 8 },
  syncBanner: { backgroundColor: "#1e293b", paddingHorizontal: 12, paddingVertical: 6 },
  syncBannerText: { color: "#94a3b8", fontSize: 12 },
  detailText: { color: "#64748b", fontSize: 11, marginTop: 6 },
  retryButton: { alignSelf: "flex-start", backgroundColor: "#334155", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 8 },
  retryButtonText: { color: "#f8fafc", fontSize: 13, fontWeight: "bold" },
});
