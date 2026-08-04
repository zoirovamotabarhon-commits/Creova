import { useColorScheme } from "react-native";

export function useTheme() {
  const colorScheme = useColorScheme();

  return {
    isDark: colorScheme === "dark",
    theme: colorScheme,
  };
}
