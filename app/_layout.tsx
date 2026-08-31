import "../i18n";

import {
  Redirect,
  Stack,
  usePathname,
} from "expo-router";

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import {
  AuthProvider,
  useAuthContext,
} from "../providers/AuthProvider";

import {
  ThemeProvider,
  useTheme,
} from "../hooks/useTheme";

import {
  PUBLIC_ROUTES,
  PROTECTED_ROUTES,
  RESET_PASSWORD_ROUTE,
  matchesRoute,
} from "../constants/routes";

function AppShell() {
  const pathname =
    usePathname();

  const {
    isAuthenticated,
    loading: authLoading,
  } = useAuthContext();

  const {
    colors,
    loading: themeLoading,
  } = useTheme();

  if (
    authLoading ||
    themeLoading
  ) {
    return (
      <View
        style={[
          styles.loadingContainer,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="large"
          color={colors.primary}
        />
      </View>
    );
  }

  const onPublicRoute =
    PUBLIC_ROUTES.some(
      (route) =>
        matchesRoute(
          pathname,
          route,
        ),
    );

  const onProtectedRoute =
    PROTECTED_ROUTES.some(
      (route) =>
        matchesRoute(
          pathname,
          route,
        ),
    );

  const onResetPasswordRoute =
    matchesRoute(
      pathname,
      RESET_PASSWORD_ROUTE,
    );

  if (
    !isAuthenticated &&
    onProtectedRoute
  ) {
    return (
      <Redirect
        href="/login"
      />
    );
  }

  if (
    isAuthenticated &&
    onPublicRoute &&
    !onResetPasswordRoute
  ) {
    return (
      <Redirect
        href="/dashboard"
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,

        contentStyle: {
          backgroundColor:
            colors.background,
        },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles =
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },
  });
