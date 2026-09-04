import {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { supabase } from "../services/supabase";
import { updatePassword } from "../services/auth";
import {
  validatePassword,
  validatePasswordMatch,
} from "../utils/validators";

type ResetLinkParams = {
  access_token?: string;
  refresh_token?: string;
  code?: string;
  type?: string;
};

function parseParams(
  url: string
): ResetLinkParams {
  const params: ResetLinkParams = {};

  const questionIndex =
    url.indexOf("?");

  const hashIndex =
    url.indexOf("#");

  let queryPart = "";

  if (questionIndex >= 0) {
    queryPart = url.slice(
      questionIndex + 1,
      hashIndex >= 0
        ? hashIndex
        : url.length
    );
  }

  let hashPart = "";

  if (hashIndex >= 0) {
    hashPart = url.slice(
      hashIndex + 1
    );
  }

  const combined =
    `${queryPart}&${hashPart}`;

  combined
    .split("&")
    .forEach((item) => {
      if (!item) {
        return;
      }

      const separator =
        item.indexOf("=");

      if (separator < 0) {
        return;
      }

      const key = item.slice(
        0,
        separator
      );

      const value = item.slice(
        separator + 1
      );

      try {
        params[
          key as keyof ResetLinkParams
        ] = decodeURIComponent(value);
      } catch {
        params[
          key as keyof ResetLinkParams
        ] = value;
      }
    });

  return params;
}

export default function ResetPasswordScreen() {
  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [ready, setReady] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    const handleResetUrl = async (
      url: string
    ) => {
      if (
        !url.startsWith(
          "creova://reset-password"
        )
      ) {
        return;
      }

      try {
        const params =
          parseParams(url);

        if (
          params.access_token &&
          params.refresh_token
        ) {
          const { error } =
            await supabase.auth.setSession({
              access_token:
                params.access_token,
              refresh_token:
                params.refresh_token,
            });

          if (error) {
            throw error;
          }
        } else if (params.code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(
              params.code
            );

          if (error) {
            throw error;
          }
        }

        if (mounted) {
          setReady(true);
        }
      } catch (error) {
        console.error(
          "Password reset link error:",
          error
        );

        if (mounted) {
          setReady(false);

          Alert.alert(
            "CREOVA",
            error instanceof Error
              ? error.message
              : "Parolni tiklash havolasi yaroqsiz yoki muddati tugagan."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const loadInitialUrl =
      async () => {
        try {
          const url =
            await Linking.getInitialURL();

          if (url) {
            await handleResetUrl(url);
          } else {
            const {
              data: { session },
            } =
              await supabase.auth.getSession();

            if (mounted) {
              setReady(!!session);
              setLoading(false);
            }
          }
        } catch (error) {
          console.error(
            "Reset URL load error:",
            error
          );

          if (mounted) {
            setReady(false);
            setLoading(false);
          }
        }
      };

    void loadInitialUrl();

    const subscription =
      Linking.addEventListener(
        "url",
        ({ url }) => {
          void handleResetUrl(url);
        }
      );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const handleUpdatePassword =
    async () => {
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

      setSaving(true);

      try {
        const result =
          await updatePassword(
            password
          );

        if (!result.success) {
          Alert.alert(
            "CREOVA",
            result.message
          );
          return;
        }

        Alert.alert(
          "CREOVA",
          "Parol muvaffaqiyatli yangilandi.",
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
          "CREOVA",
          error instanceof Error
            ? error.message
            : "Parolni yangilashda xatolik yuz berdi."
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#2563EB"
        />
        <Text style={styles.loadingText}>
          Tekshirilmoqda...
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>
          Havola yaroqsiz
        </Text>

        <Text style={styles.errorText}>
          Parolni tiklash havolasi
          yaroqsiz yoki muddati tugagan.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() =>
            router.replace(
              "/forgot-password"
            )
          }
        >
          <Text style={styles.buttonText}>
            Qayta urinib ko&apos;rish
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <View style={styles.content}>
        <Text style={styles.logo}>
          CREOVA
        </Text>

        <Text style={styles.title}>
          Yangi parol
        </Text>

        <Text style={styles.subtitle}>
          Yangi parolingizni kiriting.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Yangi parol"
          placeholderTextColor="#64748B"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
        />

        <TextInput
          style={styles.input}
          placeholder="Parolni qayta kiriting"
          placeholderTextColor="#64748B"
          value={confirmPassword}
          onChangeText={
            setConfirmPassword
          }
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!saving}
        />

        <Pressable
          style={[
            styles.button,
            saving &&
              styles.buttonDisabled,
          ]}
          onPress={() => {
            void handleUpdatePassword();
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={styles.buttonText}
            >
              Parolni saqlash
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() =>
            router.replace("/login")
          }
          disabled={saving}
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

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#0F172A",
  },

  loadingText: {
    color: "#94A3B8",
    marginTop: 12,
    fontSize: 15,
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
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 10,
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

  errorTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },

  errorText: {
    color: "#94A3B8",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 24,
  },
});
