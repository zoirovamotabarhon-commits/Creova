import { View, Text, StyleSheet } from "react-native";

type Props = {
  title: string;
  description: string;
};

export default function AIFeatureCard({
  title,
  description,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    marginBottom: 15,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  description: {
    color: "#94A3B8",
    marginTop: 8,
    fontSize: 14,
  },
});
