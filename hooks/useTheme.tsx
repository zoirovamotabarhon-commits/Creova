import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { Theme } from "../constants/theme";

export type ThemeMode = "light" | "dark" | "system";

export type ThemeColors = {
  background: string;
  card: string;
  text: string;
  mutedText: string;
  primary: string;
  border: string;
};

export interface ThemeContextValue {
  mode: ThemeMode;
  darkMode: boolean;
  isDark: boolean;
  colors: ThemeColors;
  loading: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext =
  createContext<ThemeContextValue | undefined>(undefined);

function getSystemMode(): ThemeMode {
  return Appearance.getColorScheme() === "dark"
    ? "dark"
    : "light";
}

function getColors(mode: ThemeMode): ThemeColors {
  const resolvedMode =
    mode === "system" ? getSystemMode() : mode;

  return resolvedMode === "dark"
    ? Theme.dark
    : Theme.light;
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mode, setModeState] =
    useState<ThemeMode>("system");

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const saved =
          await AsyncStorage.getItem(
            STORAGE_KEYS.THEME
          );

        if (!mounted) {
          return;
        }

        if (
          saved === "light" ||
          saved === "dark" ||
          saved === "system"
        ) {
          setModeState(saved);
        }
      } catch (error) {
        console.warn(
          "Failed to load theme:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadTheme();

    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = async (
    nextMode: ThemeMode
  ) => {
    setModeState(nextMode);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.THEME,
        nextMode
      );
    } catch (error) {
      console.warn(
        "Failed to save theme:",
        error
      );
    }
  };

  const toggleTheme = async () => {
    const currentDark =
      mode === "system"
        ? getSystemMode() === "dark"
        : mode === "dark";

    await setThemeMode(
      currentDark ? "light" : "dark"
    );
  };

  const colors = useMemo(
    () => getColors(mode),
    [mode]
  );

  const darkMode =
    mode === "system"
      ? getSystemMode() === "dark"
      : mode === "dark";

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      darkMode,
      isDark: darkMode,
      colors,
      loading,
      setThemeMode,
      setMode: setThemeMode,
      toggleTheme,
    }),
    [
      mode,
      darkMode,
      colors,
      loading,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context =
    useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider."
    );
  }

  return context;
}
