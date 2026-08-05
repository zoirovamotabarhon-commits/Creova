import { View, StyleSheet } from "react-native";

export default function Card({ children }: any) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
});
