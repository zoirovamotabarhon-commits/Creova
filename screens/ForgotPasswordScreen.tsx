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
import { resetPassword } from "../services/auth";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      Alert.alert("CREOVA", "Email manzilini kiriting.");
      return;
    }

    setLoading(true);

    try {
      const result = await resetPassword(cleanEmail);

      if (!result.success) {
        Alert.alert(
          "Xatolik",
          result.message
        );
        return;
      }

      Alert.alert(
        "CREOVA",
        "Parolni tiklash uchun havola emailingizga yuborildi.",
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
        "Parolni tiklash vaqtida kutilmagan xatolik yuz berdi."
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

        <Text style={styles.title}>
          Parolni tiklash
        </Text>

        <Text style={styles.subtitle}>
          Email manzilingizni kiriting.{"\n"}
          Sizga parolni tiklash havolasini yuboramiz.
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

        <Pressable
          style={[
            styles.button,
            loading && styles.buttonDisabled,
          ]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>
              Tiklash havolasini yuborish
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => router.replace("/login")}
          disabled={loading}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>
            Login sahifasiga qaytish
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
    marginTop: 10,
    marginBottom: 28,
    fontSize: 16,
    lineHeight: 24,
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
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
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
