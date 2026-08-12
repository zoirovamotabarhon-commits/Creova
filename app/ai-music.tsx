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
import { Audio, AVPlaybackStatus } from "expo-av";

import { generateMusic } from "../services/music";

export default function AIMusicScreen() {
  const [prompt, setPrompt] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);

  const unloadSound = async () => {
    const sound = soundRef.current;

    if (!sound) {
      return;
    }

    try {
      await sound.unloadAsync();
    } catch (error) {
      console.warn("Audio unload error:", error);
    } finally {
      soundRef.current = null;
      setPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      void unloadSound();
    };
  }, []);

  const handlePlaybackStatus = (
    playbackStatus: AVPlaybackStatus
  ) => {
    if (!playbackStatus.isLoaded) {
      setPlaying(false);
      return;
    }

    setPlaying(playbackStatus.isPlaying);

    if (playbackStatus.didJustFinish) {
      setPlaying(false);
    }
  };

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      Alert.alert(
        "CREOVA",
        "Мусиқа учун prompt киритинг."
      );
      return;
    }

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      await unloadSound();
      setAudioUrl(null);

      const result = await generateMusic(cleanPrompt);

      if (!result.success) {
        Alert.alert(
          "AI Music",
          result.error ??
            "Мусиқа яратишда хато юз берди."
        );
        return;
      }

      const url = result.audioUrl?.trim();

      if (!url) {
        Alert.alert(
          "CREOVA",
          "Мусиқа аудио файли олинмади."
        );
        return;
      }

      setAudioUrl(url);

      Alert.alert(
        "CREOVA",
        "Мусиқа тайёр бўлди."
      );
    } catch (error) {
      console.error("AI Music error:", error);

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

  const handlePlayPause = async () => {
    if (!audioUrl || loading) {
      return;
    }

    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          {
            shouldPlay: true,
            progressUpdateIntervalMillis: 250,
          },
          handlePlaybackStatus
        );

        soundRef.current = sound;
        return;
      }

      const status =
        await soundRef.current.getStatusAsync();

      if (!status.isLoaded) {
        await unloadSound();
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (error) {
      console.error("Audio playback error:", error);

      setPlaying(false);

      Alert.alert(
        "Audio xatosi",
        error instanceof Error
          ? error.message
          : "Аудиони ишга туширишда хато юз берди."
      );
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
        placeholder="Масалан: cinematic piano music"
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
            Яратилган мусиқани эшитишингиз мумкин.
          </Text>

          <Pressable
            style={styles.playButton}
            onPress={() => {
              void handlePlayPause();
            }}
          >
            <Text style={styles.playButtonText}>
              {playing ? "⏸ Тўхтатиш" : "▶️ Эшитиш"}
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
    height: 48,
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },

  playButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
