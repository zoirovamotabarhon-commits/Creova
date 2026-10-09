import { useCallback, useEffect, useRef, useState } from "react";
import {
ActivityIndicator,
Alert,
FlatList,
KeyboardAvoidingView,
Platform,
Pressable,
StyleSheet,
Text,
TextInput,
View,
} from "react-native";
import {
AudioModule,
createAudioPlayer,
RecordingPresets,
setAudioModeAsync,
useAudioRecorder,
useAudioRecorderState,
type AudioPlayer,
} from "expo-audio";

import {
createConversation,
deleteConversation,
getConversationMessages,
listConversations,
sendMessage,
uploadVoiceMessage,
type AIMessage,
type ChatConversation,
type ChatMessage,
} from "../services/chat";

function formatMessageTime(value: string): string {
const date = new Date(value);

if (Number.isNaN(date.getTime())) {
return "";
}

return date.toLocaleTimeString([], {
hour: "2-digit",
minute: "2-digit",
});
}

function formatDuration(milliseconds: number | null): string {
const totalSeconds = Math.max(
0,
Math.round((milliseconds ?? 0) / 1000),
);
const minutes = Math.floor(totalSeconds / 60);
const seconds = totalSeconds % 60;

return "${minutes}:${String(seconds).padStart(2, "0")}";
}

function VoiceMessageBubble({ message }: { message: ChatMessage }) {
const playerRef = useRef<AudioPlayer | null>(null);
const statusSubscriptionRef = useRef<{
remove: () => void;
} | null>(null);
const [playing, setPlaying] = useState(false);

useEffect(() => {
return () => {
statusSubscriptionRef.current?.remove();
statusSubscriptionRef.current = null;
playerRef.current?.remove();
playerRef.current = null;
};
}, []);

const togglePlayback = () => {
if (!message.audio_url) {
return;
}

if (!playerRef.current) {
  const player = createAudioPlayer(message.audio_url);
  playerRef.current = player;

  statusSubscriptionRef.current = player.addListener(
    "playbackStatusUpdate",
    (status) => {
      setPlaying(status.playing);

      if (status.didJustFinish) {
        setPlaying(false);
      }
    },
  );

  player.play();
  setPlaying(true);
  return;
}

if (playerRef.current.playing) {
  playerRef.current.pause();
  setPlaying(false);
} else {
  playerRef.current.play();
  setPlaying(true);
}

};

return (
<View style={styles.voiceRow}>
<Pressable style={styles.voicePlay} onPress={togglePlayback}>
<Text style={styles.voicePlayText}>
{playing ? "❚❚" : "▶"}
</Text>
</Pressable>

  <View style={styles.voiceTrack}>
    <View style={styles.voiceTrackLine} />
    <Text style={styles.voiceDuration}>
      {formatDuration(message.audio_duration_ms)}
    </Text>
  </View>
</View>

);
}

export default function AIChatScreen() {
const [conversations, setConversations] = useState<ChatConversation[]>([]);
const [conversationId, setConversationId] = useState<string>();
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [input, setInput] = useState("");
const [loading, setLoading] = useState(false);
const [loadingHistory, setLoadingHistory] = useState(true);
const [sidebarOpen, setSidebarOpen] = useState(false);
const [recordingError, setRecordingError] = useState<string | null>(null);

const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
const recorderState = useAudioRecorderState(audioRecorder);

const loadConversations = useCallback(async () => {
try {
const result = await listConversations();
setConversations(result);

  setConversationId((current) => {
    if (current && result.some((item) => item.id === current)) {
      return current;
    }

    return result[0]?.id;
  });
} catch (error) {
  console.error("Load conversations error:", error);
}

}, []);

const loadMessages = useCallback(async (id: string) => {
setLoadingHistory(true);

try {
  const result = await getConversationMessages(id);
  setMessages(result);
} catch (error) {
  console.error("Load messages error:", error);
  setMessages([]);
} finally {
  setLoadingHistory(false);
}

}, []);

useEffect(() => {
let cancelled = false;

void setAudioModeAsync({
  playsInSilentMode: true,
  allowsRecording: true,
});

const loadInitialConversations = async () => {
  try {
    const result = await listConversations();

    if (cancelled) {
      return;
    }

    setConversations(result);

    setConversationId((current) => {
      if (current && result.some((item) => item.id === current)) {
        return current;
      }

      return result[0]?.id;
    });
  } catch (error) {
    if (!cancelled) {
      console.error("Load conversations error:", error);
    }
  }
};

void loadInitialConversations();

return () => {
  cancelled = true;
};

}, []);

useEffect(() => {
let cancelled = false;

if (!conversationId) {
  setMessages([]);
  setLoadingHistory(false);

  return () => {
    cancelled = true;
  };
}

const loadSelectedMessages = async () => {
  setLoadingHistory(true);

  try {
    const result = await getConversationMessages(conversationId);

    if (!cancelled) {
      setMessages(result);
    }
  } catch (error) {
    if (!cancelled) {
      console.error("Load messages error:", error);
      setMessages([]);
    }
  } finally {
    if (!cancelled) {
      setLoadingHistory(false);
    }
  }
};

void loadSelectedMessages();

return () => {
  cancelled = true;
};

}, [conversationId]);

const ensureConversation = useCallback(async (): Promise<string> => {
if (conversationId) {
return conversationId;
}

const conversation = await createConversation();

setConversations((previous) => [conversation, ...previous]);
setConversationId(conversation.id);

return conversation.id;

}, [conversationId]);

const handleNewChat = async () => {
try {
const conversation = await createConversation();

  setConversations((previous) => [conversation, ...previous]);
  setConversationId(conversation.id);
  setMessages([]);
  setInput("");
  setSidebarOpen(false);
} catch (error) {
  console.error("New conversation error:", error);

  Alert.alert(
    "CREOVA AI",
    error instanceof Error ? error.message : "Unable to create chat.",
  );
}

};

const handleDeleteChat = async (id: string) => {
try {
await deleteConversation(id);

  const remaining = conversations.filter((item) => item.id !== id);
  setConversations(remaining);

  if (conversationId === id) {
    setConversationId(remaining[0]?.id);

    if (!remaining[0]) {
      setMessages([]);
    }
  }
} catch (error) {
  console.error("Delete conversation error:", error);

  Alert.alert(
    "CREOVA AI",
    error instanceof Error ? error.message : "Chatni o'chirib bo'lmadi.",
  );
}

};

const handleSend = async () => {
const cleanMessage = input.trim();

if (!cleanMessage || loading || recorderState.isRecording) {
  return;
}

setInput("");
setLoading(true);

try {
  const activeConversationId = await ensureConversation();

  const history: AIMessage[] = messages
    .filter((message) => message.message_type === "text")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const response = await sendMessage(
    cleanMessage,
    history,
    activeConversationId,
  );

  if (!response.success) {
    Alert.alert(
      "CREOVA AI",
      response.error ?? "AI bilan bog'lanishda xatolik yuz berdi.",
    );
    return;
  }

  await loadMessages(activeConversationId);
  await loadConversations();
} catch (error) {
  console.error("AI chat error:", error);

  Alert.alert(
    "CREOVA AI",
    error instanceof Error
      ? error.message
      : "Kutilmagan xatolik yuz berdi.",
  );
} finally {
  setLoading(false);
}

};

const startRecording = async () => {
setRecordingError(null);

try {
  const permission =
    await AudioModule.requestRecordingPermissionsAsync();

  if (!permission.granted) {
    setRecordingError("Mikrofon ruxsati berilmadi.");
    return;
  }

  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: true,
  });

  await ensureConversation();
  await audioRecorder.prepareToRecordAsync();
  audioRecorder.record();
} catch (error) {
  console.error("Start recording error:", error);

  setRecordingError(
    error instanceof Error
      ? error.message
      : "Ovoz yozishni boshlashda xatolik yuz berdi.",
  );
}

};

const stopRecording = async () => {
if (!recorderState.isRecording || loading) {
return;
}

setLoading(true);

try {
  const durationMs = recorderState.durationMillis;

  await audioRecorder.stop();

  const uri = audioRecorder.uri;
  const activeConversationId = conversationId;

  if (!uri || !activeConversationId) {
    throw new Error("Ovoz yozuvi topilmadi.");
  }

  await uploadVoiceMessage(
    activeConversationId,
    uri,
    durationMs,
  );

  await loadMessages(activeConversationId);
  await loadConversations();
} catch (error) {
  console.error("Send voice message error:", error);

  setRecordingError(
    error instanceof Error
      ? error.message
      : "Ovozli xabarni yuborishda xatolik yuz berdi.",
  );
} finally {
  setLoading(false);
}

};

const renderMessage = ({ item }: { item: ChatMessage }) => {
const isUser = item.role === "user";

return (
  <View
    style={[
      styles.message,
      isUser ? styles.userMessage : styles.assistantMessage,
    ]}
  >
    <Text style={styles.messageRole}>
      {isUser ? "Siz" : "CREOVA AI"}
    </Text>

    {item.message_type === "voice" ? (
      <VoiceMessageBubble message={item} />
    ) : (
      <Text style={styles.messageText}>{item.content}</Text>
    )}

    <Text style={styles.messageTime}>
      {formatMessageTime(item.created_at)}
    </Text>
  </View>
);

};

return (
<KeyboardAvoidingView
style={styles.container}
behavior={Platform.OS === "ios" ? "padding" : "height"}
keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
>
<View style={styles.header}>
<Pressable
onPress={() => setSidebarOpen((open) => !open)}
style={styles.menuButton}
>
<Text style={styles.menuText}>☰</Text>
</Pressable>

    <View style={styles.headerText}>
      <Text style={styles.title}>🤖 CREOVA AI</Text>
      <Text style={styles.subtitle}>AI Assistant</Text>
    </View>

    <Pressable
      onPress={() => void handleNewChat()}
      style={styles.newButton}
    >
      <Text style={styles.newButtonText}>+</Text>
    </Pressable>
  </View>

  {sidebarOpen && (
    <View style={styles.sidebar}>
      <Text style={styles.sidebarTitle}>Chat History</Text>

      <Pressable
        style={styles.newChatButton}
        onPress={() => void handleNewChat()}
      >
        <Text style={styles.newChatText}>+ New chat</Text>
      </Pressable>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.conversationRow}>
            <Pressable
              style={styles.conversationButton}
              onPress={() => {
                setConversationId(item.id);
                setSidebarOpen(false);
              }}
            >
              <Text
                numberOfLines={1}
                style={styles.conversationTitle}
              >
                {item.title}
              </Text>

              <Text style={styles.conversationTime}>
                {formatMessageTime(item.updated_at)}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void handleDeleteChat(item.id)}
            >
              <Text style={styles.deleteText}>×</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )}

  <FlatList
    data={messages}
    keyExtractor={(item) => item.id}
    style={styles.list}
    contentContainerStyle={[
      styles.listContent,
      messages.length === 0 && styles.emptyContent,
    ]}
    renderItem={renderMessage}
    ListEmptyComponent={
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>CREOVA AI</Text>

        <Text style={styles.emptyText}>
          Men sizning AI Assistant&apos;ingizman.{"\n\n"}
          Savol bering, g&apos;oya bering yoki vazifa bering.
        </Text>
      </View>
    }
  />

  {loadingHistory && (
    <View style={styles.loading}>
      <ActivityIndicator />
      <Text style={styles.loadingText}>Chat yuklanmoqda...</Text>
    </View>
  )}

  {loading && (
    <View style={styles.loading}>
      <ActivityIndicator />
      <Text style={styles.loadingText}>
        CREOVA javob tayyorlamoqda...
      </Text>
    </View>
  )}

  {recordingError && (
    <Text style={styles.recordingError}>{recordingError}</Text>
  )}

  <View style={styles.inputArea}>
    <TextInput
      style={styles.input}
      value={input}
      onChangeText={setInput}
      placeholder="Xabaringizni yozing..."
      placeholderTextColor="#64748B"
      multiline
      editable={!loading && !recorderState.isRecording}
    />

    <Pressable
      style={[
        styles.voiceButton,
        recorderState.isRecording && styles.voiceButtonRecording,
      ]}
      onPress={() =>
        void (recorderState.isRecording
          ? stopRecording()
          : startRecording())
      }
      disabled={loading}
    >
      <Text style={styles.voiceButtonText}>
        {recorderState.isRecording ? "■" : "🎙"}
      </Text>
    </Pressable>

    <Pressable
      style={[
        styles.sendButton,
        (!input.trim() || loading || recorderState.isRecording) &&
          styles.sendButtonDisabled,
      ]}
      onPress={() => void handleSend()}
      disabled={
        !input.trim() || loading || recorderState.isRecording
      }
    >
      <Text style={styles.sendText}>Yuborish</Text>
    </Pressable>
  </View>
</KeyboardAvoidingView>

);
}

const styles = StyleSheet.create({
container: { flex: 1, backgroundColor: "#0F172A" },
header: {
paddingTop: 56,
paddingHorizontal: 16,
paddingBottom: 16,
borderBottomWidth: 1,
borderBottomColor: "#1E293B",
flexDirection: "row",
alignItems: "center",
},
menuButton: {
width: 42,
height: 42,
alignItems: "center",
justifyContent: "center",
},
menuText: { color: "#FFFFFF", fontSize: 24 },
headerText: { flex: 1 },
title: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
subtitle: { color: "#94A3B8", marginTop: 3, fontSize: 13 },
newButton: {
width: 42,
height: 42,
borderRadius: 21,
backgroundColor: "#2563EB",
alignItems: "center",
justifyContent: "center",
},
newButtonText: { color: "#FFFFFF", fontSize: 28 },
sidebar: {
position: "absolute",
top: 120,
left: 0,
bottom: 0,
width: 300,
zIndex: 20,
backgroundColor: "#111827",
padding: 16,
borderRightWidth: 1,
borderRightColor: "#1E293B",
},
sidebarTitle: {
color: "#FFFFFF",
fontSize: 20,
fontWeight: "700",
marginBottom: 14,
},
newChatButton: {
padding: 12,
borderRadius: 10,
backgroundColor: "#1D4ED8",
marginBottom: 12,
},
newChatText: { color: "#FFFFFF", fontWeight: "600" },
conversationRow: {
flexDirection: "row",
alignItems: "center",
borderBottomWidth: 1,
borderBottomColor: "#1E293B",
},
conversationButton: { flex: 1, paddingVertical: 12 },
conversationTitle: { color: "#CBD5E1", fontSize: 14 },
conversationTime: { color: "#64748B", fontSize: 11, marginTop: 3 },
deleteText: { color: "#EF4444", fontSize: 22, paddingHorizontal: 8 },
list: { flex: 1 },
listContent: { padding: 16, gap: 12 },
emptyContent: { flexGrow: 1, justifyContent: "center" },
empty: { alignItems: "center", paddingHorizontal: 30 },
emptyTitle: {
color: "#FFFFFF",
fontSize: 30,
fontWeight: "800",
marginBottom: 12,
},
emptyText: {
color: "#94A3B8",
fontSize: 15,
lineHeight: 23,
textAlign: "center",
},
message: { padding: 14, borderRadius: 14, maxWidth: "90%" },
userMessage: { alignSelf: "flex-end", backgroundColor: "#1D4ED8" },
assistantMessage: { alignSelf: "flex-start", backgroundColor: "#1E293B" },
messageRole: {
color: "#CBD5E1",
fontSize: 12,
fontWeight: "700",
marginBottom: 5,
},
messageText: { color: "#FFFFFF", fontSize: 15, lineHeight: 22 },
messageTime: {
color: "#94A3B8",
fontSize: 10,
textAlign: "right",
marginTop: 7,
},
voiceRow: { flexDirection: "row", alignItems: "center", minWidth: 190 },
voicePlay: {
width: 40,
height: 40,
borderRadius: 20,
backgroundColor: "rgba(255,255,255,0.16)",
alignItems: "center",
justifyContent: "center",
},
voicePlayText: { color: "#FFFFFF", fontSize: 15 },
voiceTrack: { flex: 1, marginLeft: 10 },
voiceTrackLine: {
height: 4,
borderRadius: 2,
backgroundColor: "rgba(255,255,255,0.35)",
},
voiceDuration: { color: "#CBD5E1", fontSize: 11, marginTop: 5 },
loading: {
flexDirection: "row",
alignItems: "center",
gap: 8,
paddingHorizontal: 16,
paddingVertical: 8,
},
loadingText: { color: "#94A3B8", fontSize: 13 },
recordingError: {
color: "#FCA5A5",
fontSize: 12,
paddingHorizontal: 16,
paddingBottom: 5,
},
inputArea: {
flexDirection: "row",
alignItems: "flex-end",
gap: 8,
padding: 12,
borderTopWidth: 1,
borderTopColor: "#1E293B",
},
input: {
flex: 1,
minHeight: 46,
maxHeight: 130,
backgroundColor: "#1E293B",
borderRadius: 14,
color: "#FFFFFF",
paddingHorizontal: 14,
paddingVertical: 12,
fontSize: 15,
},
voiceButton: {
width: 46,
height: 46,
borderRadius: 14,
backgroundColor: "#334155",
alignItems: "center",
justifyContent: "center",
},
voiceButtonRecording: { backgroundColor: "#DC2626" },
voiceButtonText: { color: "#FFFFFF", fontSize: 19 },
sendButton: {
minHeight: 46,
paddingHorizontal: 18,
borderRadius: 14,
backgroundColor: "#2563EB",
alignItems: "center",
justifyContent: "center",
},
sendButtonDisabled: { opacity: 0.45 },
sendText: { color: "#FFFFFF", fontWeight: "700" },
});
