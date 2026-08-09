import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { generateMusic } from "../services/music";

export default function AIMusicScreen() {
  const [prompt, setPrompt] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      Alert.alert(
        "CREOVA",
        "Мусиқа учун prompt киритинг."
      );
      return;
    }

    setLoading(true);
    setAudioUrl(null);

    try {
      const result = await generateMusic(cleanPrompt);

      if (!result.success) {
        Alert.alert(
          "Music generation failed",
          result.error ?? "Мусиқа яратишда хато юз берди."
        );
        return;
      }

      if (!result.audioUrl) {
        Alert.alert(
          "CREOVA",
          "Мусиқа файли олинмади."
        );
        return;
      }

      setAudioUrl(result.audioUrl);

      Alert.alert(
        "CREOVA",
        "Мусиқа тайёр бўлди."
      );
    } catch (error) {
      Alert.alert(
        "Хатолик",
        error instanceof Error
          ? error.message
          : "Мусиқа яратишда кутилмаган хато юз берди."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎵 AI Music</Text>

      <Text style={styles.subtitle}>
        CREOVA AI орқали мусиқа яратинг
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Масалан: Cinematic piano music with emotional strings"
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
            Мусиқа яратиш
          </Text>
        )}
      </Pressable>

      {audioUrl && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            🎶 Мусиқа тайёр
          </Text>

          <Text style={styles.resultText}>
            Аудио файли муваффақиятли олинди.
          </Text>

          <Text
            style={styles.urlText}
            numberOfLines={3}
          >
            {audioUrl}
          </Text>
        </View>
      )}
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
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },

  input: {
    minHeight: 120,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
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

  resultCard: {
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },

  resultTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },

  resultText: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
  },

  urlText: {
    color: "#60A5FA",
    fontSize: 12,
    marginTop: 12,
  },
});
