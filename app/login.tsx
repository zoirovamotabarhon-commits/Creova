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
import { login } from "../services/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      Alert.alert("CREOVA", "Email manzilini kiriting.");
      return;
    }

    if (!password) {
      Alert.alert("CREOVA", "Parolni kiriting.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(cleanEmail, password);

      if (!result.success) {
        Alert.alert("Kirish amalga oshmadi", result.message);
        return;
      }

      router.replace("/");
    } catch {
      Alert.alert(
        "Xatolik",
        "Kirish vaqtida kutilmagan xatolik yuz berdi."
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

        <Text style={styles.title}>Login</Text>

        <Text style={styles.subtitle}>
          CREOVA akkauntingizga kiring
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

        <Pressable
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Kirish</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.push("/register")}
          disabled={loading}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>
            Akkauntingiz yo'qmi? Ro'yxatdan o'ting
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/forgot-password")}
          disabled={loading}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>
            Parolni unutdingizmi?
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
    fontSize: 30,
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
    marginTop: 18,
  },
  linkText: {
    color: "#60A5FA",
    fontSize: 15,
  },
});
