import React from "react";
import { View, Text, StyleSheet } from "react-native";

type EmptyStateProps = {
  title?: string;
  description?: string;
};

export default function EmptyState({
  title = "Ma'lumot topilmadi",
  description = "Hozircha bu yerda hech narsa yo'q.",
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    opacity: 0.7,
    textAlignVertical: "center",
  },
});
