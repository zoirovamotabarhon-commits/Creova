import {
  Stack,
  usePathname,
  useRouter,
} from "expo-router";

import {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  AuthProvider,
  useAuthContext,
} from "../providers/AuthProvider";

import {
  initializeI18n,
} from "../i18n";

function AppNavigator() {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const {
    isAuthenticated,
    loading,
  } =
    useAuthContext();

  const [
    i18nReady,
    setI18nReady,
  ] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    void initializeI18n()
      .catch((error) => {
        console.error(
          "CREOVA i18n initialization failed:",
          error,
        );
      })
      .finally(() => {
        if (mounted) {
          setI18nReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      loading ||
      !i18nReady
    ) {
      return;
    }

    const isAuthRoute =
      pathname === "/login" ||
      pathname === "/register" ||
      pathname ===
        "/forgot-password" ||
      pathname ===
        "/reset-password";

    if (
      !isAuthenticated &&
      !isAuthRoute
    ) {
      router.replace(
        "/login",
      );

      return;
    }

    if (
      isAuthenticated &&
      isAuthRoute &&
      pathname !==
        "/reset-password"
    ) {
      router.replace(
        "/dashboard",
      );
    }
  }, [
    i18nReady,
    isAuthenticated,
    loading,
    pathname,
    router,
  ]);

  if (
    loading ||
    !i18nReady
  ) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          CREOVA
        </Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="index"
      />

      <Stack.Screen
        name="login"
      />

      <Stack.Screen
        name="register"
      />

      <Stack.Screen
        name="forgot-password"
      />

      <Stack.Screen
        name="reset-password"
      />

      <Stack.Screen
        name="dashboard"
      />

      <Stack.Screen
        name="profile"
      />

      <Stack.Screen
        name="settings"
      />

      <Stack.Screen
        name="ai-chat"
      />

      <Stack.Screen
        name="ai-code"
      />

      <Stack.Screen
        name="ai-image"
      />

      <Stack.Screen
        name="ai-video"
      />

      <Stack.Screen
        name="ai-music"
      />

      <Stack.Screen
        name="ai-voice"
      />

      <Stack.Screen
        name="ai-vision"
      />

      <Stack.Screen
        name="code-studio"
      />

      <Stack.Screen
        name="vision-studio"
      />

      <Stack.Screen
        name="general-assistant"
      />

      <Stack.Screen
        name="(tabs)"
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}

const styles =
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#0D0D0D",
    },

    loadingText: {
      marginTop: 12,
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },
  });
