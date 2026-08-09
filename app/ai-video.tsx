import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  generateVideo,
  getVideoStatus,
} from "../services/video";

export default function AIVideoScreen() {
  const [prompt, setPrompt] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checkVideoStatus = async (id: string) => {
    const result = await getVideoStatus(id);

    if (!result.success) {
      stopPolling();
      setLoading(false);

      Alert.alert(
        "Video xatosi",
        result.error ?? "Video holatini olishda xatolik yuz berdi."
      );

      return;
    }

    setStatus(result.status ?? "");
    setProgress(result.progress ?? 0);

    if (result.status === "completed") {
      stopPolling();
      setLoading(false);

      Alert.alert(
        "CREOVA",
        "Video tayyor bo'ldi."
      );
    }

    if (
      result.status === "failed" ||
      result.status === "cancelled"
    ) {
      stopPolling();
      setLoading(false);

      Alert.alert(
        "Video yaratilmadi",
        result.error ?? `Video holati: ${result.status}`
      );
    }
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      Alert.alert(
        "CREOVA",
        "Video uchun prompt kiriting."
      );
      return;
    }

    stopPolling();

    setLoading(true);
    setVideoId(null);
    setStatus("queued");
    setProgress(0);

    try {
      const result = await generateVideo(cleanPrompt);

      if (!result.success || !result.videoId) {
        setLoading(false);

        Alert.alert(
          "Video yaratilmadi",
          result.error ?? "Video generation failed."
        );

        return;
      }

      const id = result.videoId;

      setVideoId(id);
      setStatus(result.status ?? "queued");
      setProgress(result.progress ?? 0);

      await checkVideoStatus(id);

      pollingRef.current = setInterval(() => {
        void checkVideoStatus(id);
      }, 5000);
    } catch {
      setLoading(false);

      Alert.alert(
        "Xatolik",
        "Video yaratish vaqtida kutilmagan xatolik yuz berdi."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎬 AI Video</Text>

      <Text style={styles.subtitle}>
        CREOVA AI orqali video yarating
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Masalan: A futuristic city at sunset"
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
            Video yaratish
          </Text>
        )}
      </Pressable>

      {videoId && (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>
            Video holati
          </Text>

          <Text style={styles.statusText}>
            {status || "queued"}
          </Text>

          <Text style={styles.progressText}>
            Progress: {progress}%
          </Text>

          {loading && (
            <ActivityIndicator
              color="#60A5FA"
              style={styles.loader}
            />
          )}

          {status === "completed" && (
            <Text style={styles.completedText}>
              Video tayyor.
            </Text>
          )}
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
    marginTop: 8,
    marginBottom: 24,
    fontSize: 16,
    textAlign: "center",
  },
  input: {
    minHeight: 120,
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
  statusCard: {
    marginTop: 24,
    padding: 18,
    borderRadius: 14,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
  },
  statusTitle: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "700",
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 8,
  },
  progressText: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 8,
  },
  loader: {
    marginTop: 14,
  },
  completedText: {
    color: "#4ADE80",
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
  },
});
