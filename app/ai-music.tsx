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
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from "expo-audio";
import { useTranslation } from "react-i18next";

import { generateMusic } from "../services/music";

export default function AIMusicScreen() {
  const { t } = useTranslation();

  const [prompt, setPrompt] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);

  const statusSubscriptionRef = useRef<{
    remove: () => void;
  } | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
    });

    return () => {
      statusSubscriptionRef.current?.remove();
      statusSubscriptionRef.current = null;

      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const unloadSound = () => {
    statusSubscriptionRef.current?.remove();
    statusSubscriptionRef.current = null;

    playerRef.current?.remove();
    playerRef.current = null;

    setPlaying(false);
  };

  const handlePlaybackStatus = (status: AudioStatus) => {
    setPlaying(status.playing);

    if (status.didJustFinish) {
      setPlaying(false);
    }
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      Alert.alert(
        t("common.appName"),
        t("aiMusic.errors.emptyPrompt")
      );
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      unloadSound();
      setAudioUrl(null);

      const result = await generateMusic(cleanPrompt);

      if (!result.success) {
        Alert.alert(
          t("aiMusic.title"),
          result.error ??
            t("aiMusic.errors.generationFailed")
        );
        return;
      }

      const url = result.audioUrl?.trim();

      if (!url) {
        Alert.alert(
          t("common.appName"),
          t("aiMusic.errors.audioMissing")
        );
        return;
      }

      setAudioUrl(url);

      Alert.alert(
        t("common.appName"),
        t("aiMusic.success.generated")
      );
    } catch (error) {
      console.error("AI Music error:", error);

      Alert.alert(
        t("common.error"),
        error instanceof Error
          ? error.message
          : t("aiMusic.errors.unexpected")
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioUrl || loading) {
      return;
    }

    try {
      if (!playerRef.current) {
        const player = createAudioPlayer(audioUrl);

        playerRef.current = player;

        statusSubscriptionRef.current =
          player.addListener(
            "playbackStatusUpdate",
            handlePlaybackStatus
          );

        player.play();
        return;
      }

      if (playerRef.current.playing) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    } catch (error) {
      console.error(
        "Audio playback error:",
        error
      );

      setPlaying(false);

      Alert.alert(
        t("common.error"),
        error instanceof Error
          ? error.message
          : t("aiMusic.errors.playbackFailed")
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        🎶 {t("aiMusic.title")}
      </Text>

      <Text style={styles.subtitle}>
        {t("aiMusic.subtitle")}
      </Text>

      <TextInput
        style={styles.input}
        placeholder={t("aiMusic.promptPlaceholder")}
        placeholderTextColor="#64748B"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        textAlignVertical="top"
        editable={!loading}
      />

      <Pressable
        style={[
          styles.generateButton,
          loading && styles.disabled,
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
            {t("aiMusic.generateButton")}
          </Text>
        )}
      </Pressable>

      {audioUrl && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            🎶 {t("aiMusic.result.title")}
          </Text>

          <Text style={styles.resultText}>
            {t("aiMusic.result.description")}
          </Text>

          <Pressable
            style={styles.playButton}
            onPress={handlePlayPause}
          >
            <Text style={styles.playButtonText}>
              {playing
                ? `⏸ ${t("aiMusic.player.pause")}`
                : `▶️ ${t("aiMusic.player.play")}`}
            </Text>
          </Pressable>
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
    minHeight: 150,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    color: "#FFFFFF",
    padding: 15,
    fontSize: 16,
  },

  generateButton: {
    height: 52,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  disabled: {
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

  playButton: {
    height: 50,
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },

  playButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});