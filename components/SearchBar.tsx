import { TextInput, StyleSheet } from "react-native";

export default function SearchBar() {
  return (
    <TextInput
      placeholder="AI хизматларини қидириш..."
      placeholderTextColor="#94A3B8"
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#1E293B",
    color: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
});
