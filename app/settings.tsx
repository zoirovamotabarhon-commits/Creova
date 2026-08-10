import {
  useEffect,
  useState,
} from "react";
import {
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../utils/storageKeys";
import { useTheme } from "../hooks/useTheme";

const DEFAULT_NOTIFICATIONS = true;

export default function SettingsScreen() {
  const {
    darkMode,
    colors,
    loading: themeLoading,
    setThemeMode,
  } = useTheme();

  const [
    notifications,
    setNotifications,
  ] = useState(
    DEFAULT_NOTIFICATIONS
  );

  const [
    notificationsLoading,
    setNotificationsLoading,
  ] = useState(true);

  useEffect(() => {
    const loadNotifications =
      async () => {
        try {
          const saved =
            await AsyncStorage.getItem(
              STORAGE_KEYS.NOTIFICATIONS
            );

          if (saved !== null) {
            setNotifications(
              saved === "true"
            );
          }
        } catch {
          Alert.alert(
            "CREOVA",
            "Созламаларни юклашда хато юз берди."
          );
        } finally {
          setNotificationsLoading(
            false
          );
        }
      };

    void loadNotifications();
  }, []);

  const handleThemeChange = (
    value: boolean
  ) => {
    void setThemeMode(
      value ? "dark" : "light"
    );
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

  if (
    themeLoading ||
    notificationsLoading
  ) {
    return (
      <View
        style={[
          styles.loading,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <Text
          style={{
            color: colors.text,
          }}
        >
          Юкланмоқда...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          {
            color: colors.text,
          },
        ]}
      >
        Созламалар
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor:
              colors.card,
            borderColor:
              colors.border,
          },
        ]}
      >
        <View style={styles.row}>
          <View
            style={styles.textBlock}
          >
            <Text
              style={[
                styles.label,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Dark Mode
            </Text>

            <Text
              style={[
                styles.description,
                {
                  color:
                    colors.mutedText,
                },
              ]}
            >
              Қоронғи интерфейсни ишлатиш
            </Text>
          </View>

          <Switch
            value={darkMode}
            onValueChange={
              handleThemeChange
            }
            trackColor={{
              false: colors.border,
              true: colors.primary,
            }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View
          style={[
            styles.divider,
            {
              backgroundColor:
                colors.border,
            },
          ]}
        />

        <View style={styles.row}>
          <View
            style={styles.textBlock}
          >
            <Text
              style={[
                styles.label,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Notifications
            </Text>

            <Text
              style={[
                styles.description,
                {
                  color:
                    colors.mutedText,
                },
              ]}
            >
              Билдиришномаларни қабул қилиш
            </Text>
          </View>

          <Switch
            value={notifications}
            onValueChange={
              handleNotificationsChange
            }
            trackColor={{
              false: colors.border,
              true: colors.primary,
            }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    marginBottom: 24,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
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
    fontSize: 17,
    fontWeight: "700",
  },

  description: {
    fontSize: 13,
    marginTop: 5,
  },

  divider: {
    height: 1,
  },
});
