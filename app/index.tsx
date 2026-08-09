import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { useAuthContext } from "../providers/AuthProvider";

export default function Index() {
  const {
    user,
    loading,
  } = useAuthContext();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          size="large"
          color="#60A5FA"
        />
      </View>
    );
  }

  if (user) {
    return (
      <Redirect href="/dashboard" />
    );
  }

  return (
    <Redirect href="/login" />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
});
