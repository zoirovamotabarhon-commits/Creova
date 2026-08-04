import { View, Text, StyleSheet } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>CREOVA</Text>
      <Text style={styles.subtitle}>AI Super Platform</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#fff",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 18,
    color: "#94A3B8",
  },
});
