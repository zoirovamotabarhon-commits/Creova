import { router } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const features = [
  {
    title: "🤖 AI Chat",
    description: "CREOVA AI билан суҳбат",
    route: "/ai-chat",
  },
  {
    title: "🖼️ AI Image",
    description: "AI орқали расм яратинг",
    route: "/ai-image",
  },
  {
    title: "🎬 AI Video",
    description: "AI орқали видео яратинг",
    route: "/ai-video",
  },
  {
    title: "🎵 AI Music",
    description: "AI орқали мусиқа яратинг",
    route: "/ai-music",
  },
];

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CREOVA</Text>

      <Text style={styles.subtitle}>
        AI имкониятларини танланг
      </Text>

      <View style={styles.grid}>
        {features.map((feature) => (
          <Pressable
            key={feature.route}
            style={styles.card}
            onPress={() => router.push(feature.route as never)}
          >
            <Text style={styles.cardTitle}>
              {feature.title}
            </Text>

            <Text style={styles.cardDescription}>
              {feature.description}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.profileButton}
        onPress={() => router.push("/profile")}
      >
        <Text style={styles.profileButtonText}>
          Профиль
        </Text>
      </Pressable>

      <Pressable
        style={styles.settingsButton}
        onPress={() => router.push("/settings")}
      >
        <Text style={styles.settingsButtonText}>
          Созламалар
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

  grid: {
    gap: 14,
  },

  card: {
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 16,
    padding: 18,
  },

  cardTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "700",
  },

  cardDescription: {
    color: "#94A3B8",
    fontSize: 14,
    marginTop: 7,
  },

  profileButton: {
    height: 50,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },

  profileButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  settingsButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  settingsButtonText: {
    color: "#CBD5E1",
    fontSize: 16,
    fontWeight: "600",
  },
});
