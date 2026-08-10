import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../utils/storageKeys";

type ThemeMode = "light" | "dark";

const DEFAULT_THEME: ThemeMode = "dark";
const DEFAULT_NOTIFICATIONS = true;

export default function SettingsScreen() {
  const [theme, setTheme] =
    useState<ThemeMode>(DEFAULT_THEME);

  const [notifications, setNotifications] =
    useState(DEFAULT_NOTIFICATIONS);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [
        savedTheme,
        savedNotifications,
      ] = await Promise.all([
        AsyncStorage.getItem(
          STORAGE_KEYS.THEME
        ),
        AsyncStorage.getItem(
          STORAGE_KEYS.NOTIFICATIONS
        ),
      ]);

      if (
        savedTheme === "light" ||
        savedTheme === "dark"
      ) {
        setTheme(savedTheme);
      }

      if (savedNotifications !== null) {
        setNotifications(
          savedNotifications === "true"
        );
      }
    } catch {
      Alert.alert(
        "CREOVA",
        "Созламаларни юклашда хато юз берди."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async (
    value: boolean
  ) => {
    const nextTheme: ThemeMode = value
      ? "dark"
      : "light";

    setTheme(nextTheme);

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.THEME,
        nextTheme
      );
    } catch {
      Alert.alert(
        "CREOVA",
        "Theme созламасини сақлашда хато юз берди."
      );
    }
  };

  const handleNotificationsChange =
    async (value: boolean) => {
      setNotifications(value);

      try {
        await AsyncStorage.setItem(
          STORAGE_KEYS.NOTIFICATIONS,
          String(value)
        );
      } catch {
        Alert.alert(
          "CREOVA",
          "Notification созламасини сақлашда хато юз берди."
        );
      }
    };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>
          Юкланмоқда...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Созламалар
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={styles.label}>
              Dark Mode
            </Text>

            <Text style={styles.description}>
              Қоронғи интерфейсни ишлатиш
            </Text>
          </View>

          <Switch
            value={theme === "dark"}
            onValueChange={
              handleThemeChange
            }
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.textBlock}>
            <Text style={styles.label}>
              Notifications
            </Text>

            <Text style={styles.description}>
              Билдиришномаларни қабул қилиш
            </Text>
          </View>

          <Switch
            value={notifications}
            onValueChange={
              handleNotificationsChange
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 20,
    paddingTop: 60,
  },

  loading: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 24,
  },

  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 18,
  },

  row: {
    minHeight: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  textBlock: {
    flex: 1,
    paddingRight: 15,
  },

  label: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },

  description: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 5,
  },

  divider: {
    height: 1,
    backgroundColor: "#334155",
  },
});
