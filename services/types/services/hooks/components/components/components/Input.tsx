import { TextInput, StyleSheet } from "react-native";

export default function Input(props: any) {
  return (
    <TextInput
      placeholderTextColor="#94A3B8"
      style={styles.input}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#1E293B",
    color: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
  },
});
