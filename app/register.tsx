import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { register } from "../services/auth";
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
} from "../utils/validators";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const cleanEmail = email.trim();

    const emailError = validateEmail(cleanEmail);

    if (emailError) {
      Alert.alert("CREOVA", emailError);
      return;
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      Alert.alert("CREOVA", passwordError);
      return;
    }

    const confirmPasswordError =
      validateConfirmPassword(
        password,
        confirmPassword
      );

    if (confirmPasswordError) {
      Alert.alert(
        "CREOVA",
        confirmPasswordError
      );
      return;
    }

    setLoading(true);

    try {
      const result = await register(
        cleanEmail,
        password
      );

      if (!result.success) {
        Alert.alert(
          "Ro'yxatdan o'tish xatosi",
          result.message
        );
        return;
      }

      Alert.alert(
        "CREOVA",
        result.message ||
          "Ro'yxatdan o'tish muvaffaqiyatli yakunlandi.",
        [
          {
            text: "Kirish",
            onPress: () =>
              router.replace("/login"),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        "Xatolik",
        error instanceof Error
          ? error.message
          : "Ro'yxatdan o'tishda kutilmagan xatolik yuz berdi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>
            CREOVA
          </Text>

          <Text style={styles.subtitle}>
            Yangi hisob yarating
          </Text>

          <Text style={styles.label}>
            Email
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

          <Text style={styles.label}>
            Parol
          </Text>

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

          <Text style={styles.label}>
            Parolni qayta kiriting
          </Text>

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
              loading &&
                styles.buttonDisabled,
            ]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                Ro'yxatdan o'tish
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.linkButton}
            onPress={() =>
              router.replace("/login")
            }
            disabled={loading}
          >
            <Text
              style={styles.linkText}
            >
              Hisobingiz bormi? Kirish
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },

  content: {
    width: "100%",
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

  label: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 7,
    marginTop: 10,
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
  },

  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
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
