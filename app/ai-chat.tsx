import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { sendMessage } from "../services/chat";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export default function AIChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const cleanMessage = input.trim();

    if (!cleanMessage || loading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: cleanMessage,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await sendMessage(cleanMessage);

      if (!response.success) {
        const errorMessage: ChatMessage = {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: response.error ?? "AI bilan bog'lanishda xatolik yuz berdi.",
        };

        setMessages((current) => [...current, errorMessage]);
        return;
      }

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: response.message ?? "Javob olinmadi.",
      };

      setMessages((current) => [
        ...current,
        assistantMessage,
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: "Kutilmagan xatolik yuz berdi.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>🤖 CREOVA AI</Text>
        <Text style={styles.subtitle}>
          AI bilan suhbatlashing
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          messages.length === 0 && styles.emptyContent,
        ]}
        renderItem={({ item }) => (
          <View
            style={[
              styles.message,
              item.role === "user"
                ? styles.userMessage
                : styles.assistantMessage,
            ]}
          >
            <Text style={styles.messageRole}>
              {item.role === "user" ? "Siz" : "CREOVA AI"}
            </Text>

            <Text style={styles.messageText}>
              {item.text}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              CREOVA AI
            </Text>

            <Text style={styles.emptyText}>
              Savolingizni yozing va suhbatni boshlang.
            </Text>
          </View>
        }
      />

      {loading && (
        <View style={styles.loading}>
          <ActivityIndicator color="#60A5FA" />
          <Text style={styles.loadingText}>
            CREOVA javob tayyorlamoqda...
          </Text>
        </View>
      )}

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Xabaringizni yozing..."
          placeholderTextColor="#64748B"
          multiline
          editable={!loading}
        />

        <Pressable
          style={[
            styles.sendButton,
            (!input.trim() || loading) &&
              styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendText}>Yuborish</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94A3B8",
    marginTop: 4,
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 15,
    textAlign: "center",
    marginTop: 8,
  },
  message: {
    maxWidth: "88%",
    padding: 14,
    borderRadius: 14,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#2563EB",
  },
  assistantMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#1E293B",
  },
  messageRole: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5,
  },
  messageText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 23,
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    backgroundColor: "#0F172A",
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFFFFF",
    fontSize: 16,
  },
  sendButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
