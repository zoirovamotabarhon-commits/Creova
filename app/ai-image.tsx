import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { generateImage } from "../services/image";

export default function AIImageScreen() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      Alert.alert("CREOVA", "Rasm uchun prompt kiriting.");
      return;
    }

    setLoading(true);
    setImageUrl("");

    try {
      const result = await generateImage(cleanPrompt);

      if (!result.success) {
        Alert.alert(
          "Rasm yaratilmadi",
          result.error ?? "Noma'lum xatolik."
        );
        return;
      }

      if (!result.imageUrl) {
        Alert.alert(
          "Rasm yaratilmadi",
          "Server rasm manzilini qaytarmadi."
        );
        return;
      }

      setImageUrl(result.imageUrl);
    } catch {
      Alert.alert(
        "Xatolik",
        "Rasm yaratish vaqtida kutilmagan xatolik yuz berdi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 AI Image</Text>

      <Text style={styles.subtitle}>
        CREOVA AI orqali rasm yarating
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Masalan: futuristic city at sunset"
        placeholderTextColor="#64748B"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        editable={!loading}
      />

      <Pressable
        style={[
          styles.button,
          loading && styles.buttonDisabled,
        ]}
        onPress={handleGenerate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>
            Rasm yaratish
          </Text>
        )}
      </Pressable>

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#94A3B8",
    marginTop: 8,
    marginBottom: 24,
    fontSize: 16,
    textAlign: "center",
  },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    backgroundColor: "#1E293B",
    color: "#FFFFFF",
    padding: 14,
    fontSize: 16,
    textAlignVertical: "top",
  },
  button: {
    height: 52,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  image: {
    width: "100%",
    height: 340,
    marginTop: 24,
    borderRadius: 14,
    backgroundColor: "#1E293B",
  },
});
