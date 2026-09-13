import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { useAI } from "../hooks/useAI";

export default function AIVisionScreen() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(
    "Bu rasmni batafsil tahlil qil."
  );

  const {
    messages,
    loading,
    error,
    sendMessage,
  } = useAI();

  const requestImagePermission = async () => {
    const result =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!result.granted) {
      Alert.alert(
        "Ruxsat kerak",
        "Rasm tanlash uchun galereyaga ruxsat bering."
      );

      return false;
    }

    return true;
  };

  const requestCameraPermission = async () => {
    const result =
      await ImagePicker.requestCameraPermissionsAsync();

    if (!result.granted) {
      Alert.alert(
        "Ruxsat kerak",
        "Kamera ishlashi uchun kamera ruxsatini bering."
      );

      return false;
    }

    return true;
  };

  const convertToDataUrl = (
    base64: string,
    mimeType?: string | null
  ) => {
    const mime =
      mimeType && mimeType.startsWith("image/")
        ? mimeType
        : "image/jpeg";

    return `data:${mime};base64,${base64}`;
  };

  const pickImage = async () => {
    const allowed =
      await requestImagePermission();

    if (!allowed) {
      return;
    }

    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

    if (
      result.canceled ||
      !result.assets?.[0]
    ) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      Alert.alert(
        "Xatolik",
        "Rasm ma'lumotini olishning imkoni bo'lmadi."
      );

      return;
    }

    const dataUrl = convertToDataUrl(
      asset.base64,
      asset.mimeType
    );

    if (dataUrl.length > 6_000_000) {
      Alert.alert(
        "Rasm juda katta",
        "Iltimos, kichikroq rasm tanlang."
      );

      return;
    }

    setImageUrl(dataUrl);
  };

  const takePhoto = async () => {
    const allowed =
      await requestCameraPermission();

    if (!allowed) {
      return;
    }

    const result =
      await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

    if (
      result.canceled ||
      !result.assets?.[0]
    ) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      Alert.alert(
        "Xatolik",
        "Surat ma'lumotini olishning imkoni bo'lmadi."
      );

      return;
    }

    const dataUrl = convertToDataUrl(
      asset.base64,
      asset.mimeType
    );

    if (dataUrl.length > 6_000_000) {
      Alert.alert(
        "Rasm juda katta",
        "Iltimos, kichikroq surat oling."
      );

      return;
    }

    setImageUrl(dataUrl);
  };

  const analyze = async () => {
    if (!imageUrl) {
      Alert.alert(
        "Rasm tanlanmagan",
        "Avval rasm tanlang yoki suratga oling."
      );

      return;
    }

    const text =
      prompt.trim() ||
      "Bu rasmni batafsil tahlil qil.";

    await sendMessage(text, {
      imageUrl,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          Creova Vision
        </Text>

        <Text style={styles.subtitle}>
          Rasmni yuklang va AI yordamida tahlil qiling.
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={styles.button}
            onPress={pickImage}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              Galereyadan tanlash
            </Text>
          </Pressable>

          <Pressable
            style={styles.button}
            onPress={takePhoto}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              Kamera
            </Text>
          </Pressable>
        </View>

        {imageUrl ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.preview}
              resizeMode="contain"
            />

            <Pressable
              onPress={() => setImageUrl(null)}
              style={styles.removeButton}
            >
              <Text style={styles.removeText}>
                Rasmni olib tashlash
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyText}>
              Rasm tanlanmagan
            </Text>
          </View>
        )}

        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Rasm haqida nima bilmoqchisiz?"
          multiline
          style={styles.input}
          editable={!loading}
        />

        <Pressable
          style={[
            styles.analyzeButton,
            (!imageUrl || loading) &&
              styles.disabledButton,
          ]}
          onPress={analyze}
          disabled={!imageUrl || loading}
        >
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.analyzeText}>
              Rasmni tahlil qilish
            </Text>
          )}
        </Pressable>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        ) : null}

        {messages.length > 0 ? (
          <View style={styles.results}>
            <Text style={styles.resultTitle}>
              Natija
            </Text>

            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.message,
                  message.role === "user"
                    ? styles.userMessage
                    : styles.aiMessage,
                ]}
              >
                <Text style={styles.messageRole}>
                  {message.role === "user"
                    ? "Siz"
                    : "Creova AI"}
                </Text>

                <Text style={styles.messageText}>
                  {message.content}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  content: {
    padding: 20,
    gap: 16,
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },

  actions: {
    flexDirection: "row",
    gap: 10,
  },

  button: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },

  previewContainer: {
    borderRadius: 16,
    overflow: "hidden",
  },

  preview: {
    width: "100%",
    height: 300,
    backgroundColor: "#f1f1f1",
  },

  removeButton: {
    padding: 12,
    alignItems: "center",
    backgroundColor: "#eee",
  },

  removeText: {
    fontWeight: "600",
  },

  emptyPreview: {
    height: 220,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyText: {
    opacity: 0.5,
  },

  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    padding: 14,
    textAlignVertical: "top",
  },

  analyzeButton: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: "#111",
  },

  disabledButton: {
    opacity: 0.4,
  },

  analyzeText: {
    color: "#fff",
    fontWeight: "700",
  },

  errorBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fee",
  },

  errorText: {
    color: "#b00020",
  },

  results: {
    gap: 10,
  },

  resultTitle: {
    fontSize: 22,
    fontWeight: "700",
  },

  message: {
    padding: 14,
    borderRadius: 14,
  },

  userMessage: {
    backgroundColor: "#eee",
  },

  aiMessage: {
    backgroundColor: "#f5f5f5",
  },

  messageRole: {
    fontWeight: "700",
    marginBottom: 5,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
