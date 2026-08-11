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

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
];

const RESET_PASSWORD_ROUTE =
  "/reset-password";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/ai-chat",
  "/ai-image",
  "/ai-video",
  "/ai-music",
  "/ai-voice",
  "/ai-code",
  "/profile",
  "/settings",
];

function matchesPath(
  pathname: string,
  route: string
) {
  return (
    pathname === route ||
    pathname.startsWith(`${route}/`)
  );
}

function AppShell() {
  const pathname = usePathname();

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

  if (pathname === "/") {
    return (
      <Redirect
        href={
          isAuthenticated
            ? "/dashboard"
            : "/login"
        }
      />
    );
  }

  const onPublicRoute =
    PUBLIC_ROUTES.some((route) =>
      matchesPath(pathname, route)
    );

  const onResetPasswordRoute =
    matchesPath(
      pathname,
      RESET_PASSWORD_ROUTE
    );

  const onProtectedRoute =
    PROTECTED_ROUTES.some((route) =>
      matchesPath(pathname, route)
    );

  if (
    !isAuthenticated &&
    onProtectedRoute
  ) {
    return <Redirect href="/login" />;
  }

  if (
    isAuthenticated &&
    onPublicRoute &&
    !onResetPasswordRoute
  ) {
    return (
      <Redirect href="/dashboard" />
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
