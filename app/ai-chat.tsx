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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "../services/supabase";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  imageUri?: string;
  timestamp: string;
}

export default function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !selectedImage) || loading) return;

    const userText = input.trim();
    const currentImage = selectedImage;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      imageUri: currentImage || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSelectedImage(null);
    setLoading(true);

    try {
      let endpoint = "gemini-chat";
      let requestBody: any = { prompt: userText, history: messages.map(m => ({ role: m.sender === "user" ? "user" : "model", text: m.text })) };

      const lowerText = userText.toLowerCase();
      const isImageGen = 
        lowerText.includes("generate image") || 
        lowerText.includes("create image") || 
        lowerText.includes("draw") || 
        lowerText.includes("rasm yarat");

      if (isImageGen) {
        endpoint = "image-generate";
      } else if (currentImage) {
        endpoint = "vision-analyze";
        requestBody = { prompt: userText, imageUri: currentImage };
      }

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body: requestBody,
      });

      if (error) throw error;

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data?.text || data?.description || "Response received successfully.",
        imageUri: data?.imageUrl || data?.url,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `Error occurred: ${err.message || "Unknown error"}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

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

            {item.text ? (
              <Text style={styles.messageText}>{item.text}</Text>
            ) : null}

            <Text style={styles.timeText}>{item.timestamp}</Text>
          </View>
        )}
      />

      {selectedImage && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: selectedImage }} style={styles.previewImage} />
          <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.removePreview}>
            <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 12 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity style={styles.attachButton} onPress={pickImage} disabled={loading}>
          <Text style={styles.attachButtonText}>📷</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message, attach image or request generation..."
          placeholderTextColor="#888"
          value={input}
          onChangeText={setInput}
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.sendButton, loading && styles.disabledButton]}
          onPress={sendMessage}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
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
  inputContainer: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: "#0f172a" },
  attachButton: { padding: 10, justifyContent: "center", alignItems: "center", marginRight: 6 },
  attachButtonText: { fontSize: 20 },
  input: { flex: 1, backgroundColor: "#1e293b", color: "#fff", padding: 12, borderRadius: 8, marginRight: 8, fontSize: 15 },
  sendButton: { backgroundColor: "#2563eb", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  disabledButton: { backgroundColor: "#475569" },
  sendButtonText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
});
