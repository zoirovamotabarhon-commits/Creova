import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
  VideoView,
  useVideoPlayer,
} from "expo-video";

import {
  generateVideo,
  getVideoStatus,
} from "../services/video";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

export default function AIVideoScreen() {
  const [prompt, setPrompt] = useState("");
  const [videoId, setVideoId] =
    useState<string | null>(null);
  const [videoUrl, setVideoUrl] =
    useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const pollingRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  const pollCountRef = useRef(0);
  const checkingRef = useRef(false);

  const player = useVideoPlayer(
    videoUrl,
    (videoPlayer) => {
      videoPlayer.loop = false;
    }
  );

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    checkingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  const checkVideoStatus = useCallback(
    async (id: string): Promise<boolean> => {
      if (checkingRef.current) {
        return false;
      }

      checkingRef.current = true;

      try {
        const result = await getVideoStatus(id);

        if (!result.success) {
          stopPolling();
          setLoading(false);

          Alert.alert(
            "Video xatosi",
            result.error ??
              "Video holatini olishda xatolik yuz berdi."
          );

          return true;
        }

        const nextStatus =
          result.status ?? "unknown";

        setStatus(nextStatus);
        setProgress(result.progress ?? 0);

        if (result.videoUrl) {
          setVideoUrl(result.videoUrl);
        }

        if (nextStatus === "completed") {
          stopPolling();
          setLoading(false);

          Alert.alert(
            "CREOVA",
            result.videoUrl
              ? "Video tayyor bo'ldi."
              : "Video tayyor, lekin MP4 URL olinmadi."
          );

          return true;
        }

        if (
          nextStatus === "failed" ||
          nextStatus === "cancelled"
        ) {
          stopPolling();
          setLoading(false);

          Alert.alert(
            "Video yaratilmadi",
            result.error ??
              `Video holati: ${nextStatus}`
          );

          return true;
        }

        pollCountRef.current += 1;

        if (
          pollCountRef.current >=
          MAX_POLL_ATTEMPTS
        ) {
          stopPolling();
          setLoading(false);

          Alert.alert(
            "CREOVA",
            "Video yaratish juda uzoq davom etdi. Keyinroq statusni qayta tekshiring."
          );

          return true;
        }

        return false;
      } catch (error) {
        stopPolling();
        setLoading(false);

        Alert.alert(
          "Video xatosi",
          error instanceof Error
            ? error.message
            : "Video holatini tekshirishda xatolik."
        );

        return true;
      } finally {
        checkingRef.current = false;
      }
    },
    [stopPolling]
  );

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      Alert.alert(
        "CREOVA",
        "Video uchun prompt kiriting."
      );
      return;
    }

    if (loading) {
      return;
    }

    stopPolling();

    pollCountRef.current = 0;

    setLoading(true);
    setVideoId(null);
    setVideoUrl(null);
    setStatus("queued");
    setProgress(0);

    try {
      const result =
        await generateVideo(cleanPrompt);

      if (
        !result.success ||
        !result.videoId
      ) {
        setLoading(false);

        Alert.alert(
          "Video yaratilmadi",
          result.error ??
            "Video generation failed."
        );

        return;
      }

      const id = result.videoId;

      setVideoId(id);
      setStatus(
        result.status ?? "queued"
      );
      setProgress(
        result.progress ?? 0
      );

      if (result.videoUrl) {
        setVideoUrl(result.videoUrl);
      }

      const finished =
        await checkVideoStatus(id);

      if (finished) {
        return;
      }

      pollingRef.current =
        setInterval(() => {
          void checkVideoStatus(id);
        }, POLL_INTERVAL_MS);
    } catch (error) {
      stopPolling();
      setLoading(false);

      Alert.alert(
        "Xatolik",
        error instanceof Error
          ? error.message
          : "Video yaratishda kutilmagan xatolik yuz berdi."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        🎬 AI Video
      </Text>

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
        textAlignVertical="top"
      />

      <Pressable
        style={[
          styles.button,
          loading && styles.buttonDisabled,
        ]}
        onPress={() => {
          void handleGenerate();
        }}
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
            {status}
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

          {status === "completed" &&
            videoUrl && (
              <View style={styles.videoContainer}>
                <VideoView
                  player={player}
                  style={styles.video}
                  nativeControls
                  contentFit="contain"
                />
              </View>
            )}

          {status === "completed" &&
            !videoUrl && (
              <Text style={styles.errorText}>
                MP4 URL olinmadi.
              </Text>
            )}

          <Text
            style={styles.videoId}
            numberOfLines={1}
          >
            ID: {videoId}
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

  videoContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000000",
  },

  video: {
    width: "100%",
    height: 240,
  },

  videoId: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 10,
  },

  errorText: {
    color: "#F87171",
    fontSize: 14,
    marginTop: 14,
  },
});
