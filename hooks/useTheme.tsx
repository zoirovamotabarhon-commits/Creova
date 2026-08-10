import {
  useContext,
  createContext,
  type ReactNode,
} from "react";

export type ThemeMode =
  | "light"
  | "dark"
  | "system";

export interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext =
  createContext<ThemeContextValue | undefined>(
    undefined
  );

export function ThemeProvider({
  children,
  mode = "system",
}: {
  children: ReactNode;
  mode?: ThemeMode;
}) {
  const isDark =
    mode === "dark";

  const setMode = (
    nextMode: ThemeMode
  ) => {
    console.log(
      "Theme mode:",
      nextMode
    );
  };

  const toggleTheme = () => {
    setMode(
      isDark
        ? "light"
        : "dark"
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        setMode,
        toggleTheme,
      }}
    >
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
