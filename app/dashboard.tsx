import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FEATURES } from "../constants/features";

const FEATURE_ROUTES: Record<
  string,
  "/ai-chat" |
    "/ai-image" |
    "/ai-video" |
    "/ai-music" |
    "/ai-voice" |
    "/ai-code"
> = {
  "AI Chat": "/ai-chat",
  "AI Image": "/ai-image",
  "AI Video": "/ai-video",
  "AI Music": "/ai-music",
  "AI Voice": "/ai-voice",
  "AI Code": "/ai-code",
};

export default function DashboardScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        CREOVA
      </Text>

      <Text style={styles.subtitle}>
        AI имкониятларини танланг
      </Text>

      <View style={styles.grid}>
        {FEATURES.map((feature) => {
          const route =
            FEATURE_ROUTES[feature.title];

          if (!route) {
            return null;
          }

          return (
            <Pressable
              key={feature.title}
              style={styles.card}
              onPress={() =>
                router.push(route)
              }
            >
              <Text style={styles.cardTitle}>
                {feature.icon}{" "}
                {feature.title}
              </Text>

              <Text
                style={styles.cardDescription}
              >
                {getDescription(
                  feature.title
                )}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        style={styles.profileButton}
        onPress={() =>
          router.push("/profile")
        }
      >
        <Text
          style={styles.profileButtonText}
        >
          Профиль
        </Text>
      </Pressable>

      <Pressable
        style={styles.settingsButton}
        onPress={() =>
          router.push("/settings")
        }
      >
        <Text
          style={styles.settingsButtonText}
        >
          Созламалар
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function getDescription(
  title: string
): string {
  switch (title) {
    case "AI Chat":
      return "CREOVA AI билан суҳбат";

    case "AI Image":
      return "AI орқали расм яратинг";

    case "AI Video":
      return "AI орқали видео яратинг";

    case "AI Music":
      return "AI орқали мусиқа яратинг";

    case "AI Voice":
      return "AI орқали овоз яратинг";

    case "AI Code":
      return "AI орқали код яратинг";

    default:
      return "CREOVA AI функцияси";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 30,
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
