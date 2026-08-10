import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Theme } from "../constants/theme";
import { STORAGE_KEYS } from "../utils/storageKeys";

export type ThemeMode = keyof typeof Theme;

type ThemeContextValue = {
  themeMode: ThemeMode;
  darkMode: boolean;
  colors: (typeof Theme)[ThemeMode];
  loading: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [themeMode, setThemeModeState] =
    useState<ThemeMode>("dark");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(
          STORAGE_KEYS.THEME
        );

        if (
          mounted &&
          (savedTheme === "light" || savedTheme === "dark")
        ) {
          setThemeModeState(savedTheme);
        }
      } catch (error) {
        console.warn("Failed to load theme:", error);
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

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      setThemeModeState(mode);

      try {
        await AsyncStorage.setItem(STORAGE_KEYS.THEME, mode);
      } catch (error) {
        console.warn("Failed to save theme:", error);
      }
    },
    []
  );

  const toggleTheme = useCallback(async () => {
    const nextMode: ThemeMode =
      themeMode === "dark" ? "light" : "dark";

    await setThemeMode(nextMode);
  }, [setThemeMode, themeMode]);

  const value = useMemo(
    () => ({
      themeMode,
      darkMode: themeMode === "dark",
      colors: Theme[themeMode],
      loading,
      setThemeMode,
      toggleTheme,
    }),
    [themeMode, loading, setThemeMode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
    }
