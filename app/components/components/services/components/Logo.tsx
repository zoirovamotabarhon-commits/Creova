import { View, Text, StyleSheet } from "react-native";

export default function Logo() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>CREOVA</Text>
      <Text style={styles.subtitle}>AI Super Platform</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 30,
  },
  logo: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#2563EB",
  },
  subtitle: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 8,
  },
});
