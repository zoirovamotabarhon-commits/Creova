import React, { useState, useRef } from "react";
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
  Platform,
  Alert,
} from "react-native";
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

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  imageUri?: string;
  audioUri?: string;
  audioDurationMs?: number;
  isError?: boolean;
  timestamp: string;
}

const nowTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

async function uriToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(uri);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Audio faylni o'qib bo'lmadi."));
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
      Alert.alert("Xatolik", "Ovozni ijro etib bo'lmadi.");
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedBase64, setSelectedBase64] = useState<string | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

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
      Alert.alert("Xatolik", "Rasm tanlab bo'lmadi.");
    }
  };

  // Kameradan surat olish
  const takePhoto = async () => {
    setShowAttach(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Ruxsat kerak", "Suratga olish uchun kamera ruxsatini bering.");
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
      Alert.alert("Xatolik", "Kamerani ochib bo'lmadi.");
    }
  };

  const startRecording = async () => {
    try {
      setShowAttach(false);
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Ruxsat kerak", "Ovozli xabar uchun mikrofon ruxsatini bering.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch {
      Alert.alert("Xatolik", "Ovoz yozishni boshlab bo'lmadi.");
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
    await sendMessage({ uri, durationMs });
  };

  const sendMessage = async (voice?: { uri: string; durationMs: number }) => {
    const trimmedInput = voice ? "" : input.trim();
    if (!voice && ((!trimmedInput && !selectedImage) || loading)) return;
    if (loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: trimmedInput,
      imageUri: voice ? undefined : selectedImage || undefined,
      audioUri: voice?.uri,
      audioDurationMs: voice?.durationMs,
      timestamp: nowTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const currentImage = voice ? null : selectedImage;
    const currentBase64 = voice ? null : selectedBase64;
    clearImage();
    setLoading(true);

    try {
      const history = messages
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.sender === "user" ? "user" : "model",
          text: m.text || (m.audioUri ? "[ovozli xabar]" : m.imageUri ? "[rasm]" : ""),
        }))
        .filter((m) => m.text.trim().length > 0);

      let endpoint = "gemini-chat";
      let requestBody: any = {
        prompt: trimmedInput || "Describe this image",
        message: trimmedInput || "Describe this image",
        history,
      };

      if (voice) {
        const { base64, mimeType } = await uriToBase64(voice.uri);
        requestBody = {
          prompt:
            "Foydalanuvchi ovozli xabar yubordi. Uni diqqat bilan tinglab, xuddi shu tilda javob ber.",
          audioBase64: base64,
          audioMimeType: mimeType,
          history,
        };
      } else {
        const lowerText = trimmedInput.toLowerCase();
        const isImageGen =
          lowerText.includes("generate image") ||
          lowerText.includes("create image") ||
          lowerText.includes("draw") ||
          lowerText.includes("rasm yarat");

        if (isImageGen) {
          endpoint = "image-generate";
        } else if (currentImage) {
          endpoint = "vision-analyze";
          requestBody = {
            prompt: trimmedInput || "Describe this image in detail.",
            message: trimmedInput || "Describe this image in detail.",
            imageBase64: currentBase64,
            mimeType: "image/jpeg",
          };
        }
      }

      const { data, error } = await invokeEdgeFunction<any>(endpoint, {
        body: requestBody,
      });

      if (error) throw error;

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data?.text || data?.description || "Response received successfully.",
        imageUri: data?.imageUrl || data?.url,
        timestamp: nowTime(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `Error occurred: ${err.message || "Unknown error"}`,
        isError: true,
        timestamp: nowTime(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const hasContent = input.trim().length > 0 || !!selectedImage;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
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
            ]}
          >
            <Text style={styles.senderText}>
              {item.sender === "user" ? "You" : "CREOVA AI"}
            </Text>

            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.messageImage} resizeMode="cover" />
            ) : null}

            {item.audioUri ? (
              <VoicePlayer uri={item.audioUri} durationMs={item.audioDurationMs} />
            ) : null}

            {item.text ? (
              <Text style={styles.messageText} selectable>
                {item.text}
              </Text>
            ) : null}

            <Text style={styles.timeText}>{item.timestamp}</Text>
          </View>
        )}
      />

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
            <Text style={styles.attachOptionText}>🖼  Galereya / fayl</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={takePhoto}>
            <Text style={styles.attachOptionText}>📷  Kamera</Text>
          </TouchableOpacity>
        </View>
      )}

      {isRecording ? (
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton} onPress={cancelRecording}>
            <Text style={styles.attachButtonText}>🗑</Text>
          </TouchableOpacity>
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingDot}>●</Text>
            <Text style={styles.recordingText}>
              Yozilmoqda {formatDuration(recorderState.durationMillis ?? 0)}
            </Text>
          </View>
          <TouchableOpacity style={styles.sendButton} onPress={finishRecording}>
            <Text style={styles.sendButtonText}>Yuborish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowAttach((v) => !v)}
            disabled={loading}
          >
            <Text style={styles.attachButtonText}>📎</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Xabar yozing..."
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
              onPress={() => sendMessage()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={startRecording}>
              <Text style={styles.sendButtonText}>🎤</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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
  attachMenu: { backgroundColor: "#0f172a", paddingHorizontal: 10, paddingTop: 8, flexDirection: "row" },
  attachOption: { backgroundColor: "#1e293b", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginRight: 8 },
  attachOptionText: { color: "#f8fafc", fontSize: 14 },
  inputContainer: { flexDirection: "row", alignItems: "flex-end", padding: 10, backgroundColor: "#0f172a" },
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
});
