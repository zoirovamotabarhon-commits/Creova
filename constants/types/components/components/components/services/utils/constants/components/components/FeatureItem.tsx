import { Pressable, Text, StyleSheet } from "react-native";

type Props = {
  title: string;
  icon: string;
};

export default function FeatureItem({ title, icon }: Props) {
  return (
    <Pressable style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    alignItems: "center",
  },
  icon: {
    fontSize: 36,
    marginBottom: 10,
  },
  title: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
  },
});
