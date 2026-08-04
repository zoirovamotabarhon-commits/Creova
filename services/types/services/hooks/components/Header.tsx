import { View, Text, StyleSheet } from "react-native";

type Props = {
  title: string;
};

export default function Header({ title }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#0F172A",
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
});
