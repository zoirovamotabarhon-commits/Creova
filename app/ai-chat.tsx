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
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
        <Text style={styles.voicePlayText}>{playing ? "❚❚" : "▶"}</Text>
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
      setMessages(await getConversationMessages(id));
    } catch (error) {
      console.error("Load messages error:", error);
      setMessages([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    });
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (conversationId) {
      void loadMessages(conversationId);
    } else {
      setMessages([]);
      setLoadingHistory(false);
    }
  }, [conversationId, loadMessages]);

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
          <Text style={styles.subtitle}>
            {conversationId ? "Chat" : "Yangi suhbat"}
          </Text>
        </View>

        <Pressable
          onPress={handleNewChat}
          style={styles.newChatButton}
        >
          <Text style={styles.newChatText}>＋</Text>
        </Pressable>
      </View>

      {sidebarOpen && (
        <View style={styles.sidebar}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Chatlar tarixi</Text>

            <Pressable
              onPress={handleNewChat}
              style={styles.sidebarNewButton}
            >
              <Text style={styles.sidebarNewText}>+ Yangi chat</Text>
            </Pressable>
          </View>

          {conversations.length === 0 ? (
            <Text style={styles.emptyHistory}>
              Hozircha chatlar mavjud emas.
            </Text>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.conversationRow,
                    item.id === conversationId &&
                      styles.activeConversationRow,
                  ]}
                >
                  <Pressable
                    style={styles.conversationButton}
                    onPress={() => {
                      setConversationId(item.id);
                      setSidebarOpen(false);
                    }}
                  >
                    <Text
                      style={styles.conversationTitle}
                      numberOfLines={1}
                    >
                      {item.title || "New chat"}
                    </Text>

                    <Text style={styles.conversationDate}>
                      {formatMessageTime(item.updated_at)}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleDeleteChat(item.id)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>×</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loadingHistory ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                CREOVA AI
              </Text>
              <Text style={styles.emptyText}>
                Savolingizni yozing yoki ovozli xabar yuboring.
              </Text>
            </View>
          )
        }
      />

      {recordingError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{recordingError}</Text>
        </View>
      )}

      <View style={styles.inputArea}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={
            recorderState.isRecording
              ? "Ovoz yozilmoqda..."
              : "Xabar yozing..."
          }
          placeholderTextColor="#888"
          style={styles.input}
          multiline
          editable={!loading && !recorderState.isRecording}
          onSubmitEditing={() => {
            if (Platform.OS !== "ios") {
              void handleSend();
            }
          }}
        />

        <Pressable
          style={[
            styles.recordButton,
            recorderState.isRecording && styles.recordingButton,
          ]}
          onPress={
            recorderState.isRecording
              ? stopRecording
              : startRecording
          }
          disabled={loading}
        >
          <Text style={styles.recordButtonText}>
            {recorderState.isRecording ? "■" : "🎙"}
          </Text>
        </Pressable>

        <Pressable
          style={styles.sendButton}
          onPress={() => void handleSend()}
          disabled={
            loading ||
            recorderState.isRecording ||
            !input.trim()
          }
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendText}>➤</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f7f8",
  },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e3e3e3",
    backgroundColor: "#ffffff",
  },
  menuButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    fontSize: 24,
    color: "#222",
  },
  headerText: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  subtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  newChatButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  newChatText: {
    color: "#fff",
    fontSize: 26,
    lineHeight: 28,
  },
  sidebar: {
    position: "absolute",
    top: 64,
    left: 0,
    bottom: 0,
    width: "84%",
    maxWidth: 360,
    zIndex: 20,
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#ddd",
    padding: 14,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: {
      width: 3,
      height: 0,
    },
  },
  sidebarHeader: {
    marginBottom: 12,
  },
  sidebarTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111",
    marginBottom: 10,
  },
  sidebarNewButton: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#111",
  },
  sidebarNewText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
  emptyHistory: {
    color: "#777",
    fontSize: 14,
    paddingVertical: 20,
  },
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    marginBottom: 5,
  },
  activeConversationRow: {
    backgroundColor: "#f0f0f0",
  },
  conversationButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  conversationDate: {
    marginTop: 4,
    fontSize: 11,
    color: "#888",
  },
  deleteButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: {
    fontSize: 24,
    color: "#999",
  },
  messages: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
    flexGrow: 1,
  },
  message: {
    maxWidth: "84%",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 7,
    marginBottom: 10,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#111",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e3e3e3",
  },
  messageRole: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 5,
    color: "#888",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#222",
  },
  messageTime: {
    alignSelf: "flex-end",
    marginTop: 6,
    fontSize: 10,
    color: "#888",
  },
  voiceRow: {
    minWidth: 190,
    flexDirection: "row",
    alignItems: "center",
  },
  voicePlay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  voicePlayText: {
    color: "#fff",
    fontSize: 14,
  },
  voiceTrack: {
    flex: 1,
    marginLeft: 10,
  },
  voiceTrackLine: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#aaa",
    marginBottom: 6,
  },
  voiceDuration: {
    fontSize: 11,
    color: "#777",
  },
  emptyContainer: {
    flex: 1,
    minHeight: 400,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
  },
  emptyText: {
    textAlign: "center",
    color: "#777",
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#ffe8e8",
  },
  errorText: {
    color: "#b00020",
    fontSize: 12,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 18 : 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e3e3e3",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
    color: "#111",
    backgroundColor: "#f8f8f8",
  },
  recordButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    backgroundColor: "#eee",
  },
  recordingButton: {
    backgroundColor: "#ffdddd",
  },
  recordButtonText: {
    fontSize: 18,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    backgroundColor: "#111",
  },
  sendText: {
    color: "#fff",
    fontSize: 21,
  },
});
