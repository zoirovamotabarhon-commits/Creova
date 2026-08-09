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
import { router } from "expo-router";
import { signUp } from "../services/auth";
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
} from "../utils/validators";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      Alert.alert("CREOVA", "Email kiriting.");
      return;
    }

    if (!validateEmail(cleanEmail)) {
      Alert.alert(
        "CREOVA",
        "Email manzil noto'g'ri."
      );
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert(
        "CREOVA",
        "Parol kamida 8 ta belgidan iborat bo'lishi kerak."
      );
      return;
    }

    if (
      !validatePasswordMatch(
        password,
        confirmPassword
      )
    ) {
      Alert.alert(
        "CREOVA",
        "Parollar bir xil emas."
      );
      return;
    }

    setLoading(true);

    try {
      const result = await signUp(
        cleanEmail,
        password
      );

      if (!result.success) {
        Alert.alert(
          "Ro'yxatdan o'tish xatosi",
          result.error ??
            "Ro'yxatdan o'tishda xatolik yuz berdi."
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
    } catch (error) {
      Alert.alert(
        "Xatolik",
        error instanceof Error
          ? error.message
          : "Kutilmagan xatolik yuz berdi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>CREOVA</Text>

      <Text style={styles.subtitle}>
        Yangi hisob yarating
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748B"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
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
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Parolni qayta kiriting"
        placeholderTextColor="#64748B"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
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
          Hisobingiz bormi? Kirish
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 20,
    paddingTop: 80,
    justifyContent: "center",
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },

  input: {
    height: 52,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    color: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12,
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
    fontWeight: "600",
  },
});
