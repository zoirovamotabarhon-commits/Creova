import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { generateCode } from "../services/code";

export default function AICodeScreen() {
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      Alert.alert(
        "CREOVA",
        "Код учун вазифани ёзинг."
      );
      return;
    }

    setLoading(true);
    setCode("");

    try {
      const result = await generateCode(
        cleanPrompt
      );

      if (!result.success) {
        Alert.alert(
          "AI Code",
          result.error ??
            "Код яратишда хато юз берди."
        );
        return;
      }

      setCode(result.code ?? "");
    } catch (error) {
      Alert.alert(
        "Хатолик",
        error instanceof Error
          ? error.message
          : "Код яратишда кутилмаган хато юз берди."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          💻 AI Code
        </Text>

        <Text style={styles.subtitle}>
          CREOVA AI орқали код яратинг
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Масалан: React Native login screen ярат"
          placeholderTextColor="#64748B"
          value={prompt}
          onChangeText={setPrompt}
          multiline
          textAlignVertical="top"
          editable={!loading}
        />

        <Pressable
          style={[
            styles.button,
            loading && styles.disabled,
          ]}
          onPress={handleGenerate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Код яратиш
            </Text>
          )}
        </Pressable>

        {code ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>
              Натижа
            </Text>

            <ScrollView
              horizontal
              style={styles.codeContainer}
            >
              <Text style={styles.code}>
                {code}
              </Text>
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
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
    minHeight: 140,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    color: "#FFFFFF",
    padding: 15,
    fontSize: 16,
  },

  button: {
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
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    padding: 16,
  },

  resultTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  codeContainer: {
    backgroundColor: "#020617",
    borderRadius: 10,
    padding: 14,
  },

  code: {
    color: "#E2E8F0",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "monospace",
  },
});
