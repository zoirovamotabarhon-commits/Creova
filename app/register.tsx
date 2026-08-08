import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { register } from "../services/auth";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      Alert.alert("CREOVA", "Email manzilini kiriting.");
      return;
    }

    if (!password) {
      Alert.alert("CREOVA", "Parolni kiriting.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "CREOVA",
        "Parol kamida 6 ta belgidan iborat bo'lishi kerak."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("CREOVA", "Parollar bir xil emas.");
      return;
    }

    setLoading(true);

    try {
      const result = await register(cleanEmail, password);

      if (!result.success) {
        Alert.alert(
          "Ro'yxatdan o'tish amalga oshmadi",
          result.message
        );
        return;
      }

      Alert.alert(
        "CREOVA",
        "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi.",
        [
          {
            text: "Kirish",
            onPress: () => router.replace("/login"),
          },
        ]
      );
    } catch {
      Alert.alert(
        "Xatolik",
        "Ro'yxatdan o'tish vaqtida kutilmagan xatolik yuz berdi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>CREOVA</Text>

        <Text style={styles.title}>Ro'yxatdan o'tish</Text>

        <Text style={styles.subtitle}>
          Yangi CREOVA akkauntini yarating
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Parol"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Parolni tasdiqlang"
          placeholderTextColor="#64748B"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        <Pressable
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Ro'yxatdan o'tish
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.replace("/login")}
          disabled={loading}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>
            Akkauntingiz bormi? Kirish
          </Text>
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
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  logo: {
    textAlign: "center",
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 16,
    color: "#94A3B8",
    textAlign: "center",
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
    backgroundColor: "#1E293B",
    color: "#FFFFFF",
    fontSize: 16,
  },
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  linkButton: {
    alignItems: "center",
    marginTop: 20,
  },
  linkText: {
    color: "#60A5FA",
    fontSize: 15,
  },
});
