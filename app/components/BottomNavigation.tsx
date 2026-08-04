import { View, Pressable, Text, StyleSheet } from "react-native";

export default function BottomNavigation() {
  return (
    <View style={styles.container}>
      <Pressable style={styles.item}>
        <Text style={styles.text}>🏠 Home</Text>
      </Pressable>

      <Pressable style={styles.item}>
        <Text style={styles.text}>🤖 AI</Text>
      </Pressable>

      <Pressable style={styles.item}>
        <Text style={styles.text}>👤 Profile</Text>
      </Pressable>

      <Pressable style={styles.item}>
        <Text style={styles.text}>⚙️ Settings</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 15,
    backgroundColor: "#1E293B",
  },
  item: {
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 14,
  },
});
