import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useState } from "react";

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.subtitle}>
        CREOVA sozlamalari
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.textContainer}>
            <Text style={styles.rowTitle}>
              Bildirishnomalar
            </Text>

            <Text style={styles.rowDescription}>
              CREOVA yangiliklari va xabarlarini olish
            </Text>
          </View>

          <Switch
            value={notifications}
            onValueChange={setNotifications}
          />
        </View>

        <View style={styles.separator} />

        <View style={styles.row}>
          <View style={styles.textContainer}>
            <Text style={styles.rowTitle}>
              Dark Mode
            </Text>

            <Text style={styles.rowDescription}>
              Qorong'i interfeysdan foydalanish
            </Text>
          </View>

          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
          />
        </View>
      </View>

      <Pressable
        style={styles.profileButton}
        onPress={() => router.push("/profile")}
      >
        <Text style={styles.profileButtonText}>
          Profilni ochish
        </Text>
      </Pressable>

      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backButtonText}>
          Orqaga
        </Text>
      </Pressable>
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

  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },

  card: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 16,
    paddingHorizontal: 18,
  },

  row: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  textContainer: {
    flex: 1,
    paddingRight: 16,
  },

  rowTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  rowDescription: {
    color: "#94A3B8",
    fontSize: 13,
    marginTop: 5,
  },

  separator: {
    height: 1,
    backgroundColor: "#334155",
  },

  profileButton: {
    height: 52,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  profileButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  backButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  backButtonText: {
    color: "#CBD5E1",
    fontSize: 16,
    fontWeight: "600",
  },
});
