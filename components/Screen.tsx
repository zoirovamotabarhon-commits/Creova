import { View, StyleSheet } from "react-native";

export default function Screen({ children }: any) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 20,
  },
});
