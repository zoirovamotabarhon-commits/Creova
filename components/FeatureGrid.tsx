import { View, StyleSheet } from "react-native";

export default function FeatureGrid({ children }: any) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 20,
  },
});
