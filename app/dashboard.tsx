import { View, Text, StyleSheet } from "react-native";

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CREOVA Dashboard</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤖 AI Chat</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎨 AI Image</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎬 AI Video</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎵 AI Music</Text>
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
  title: {
    fontSize: 28,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#1E293B",
    padding: 18,
    borderRadius: 14,
    marginBottom: 15,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
});
