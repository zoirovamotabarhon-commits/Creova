import { View, Text, StyleSheet } from "react-native";

export default function AIMusicScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎵 AI Music</Text>
      <Text style={styles.subtitle}>
        AI орқали мусиқа яратинг
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "bold",
  },
  subtitle: {
    color: "#94A3B8",
    marginTop: 10,
    fontSize: 16,
  },
});
