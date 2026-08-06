import { useState } from "react";

export function useTheme() {
  const [darkMode, setDarkMode] = useState(true);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return {
    darkMode,
    toggleTheme,
  };
}
