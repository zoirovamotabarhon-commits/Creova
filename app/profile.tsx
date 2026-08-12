import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  getProfile,
  updateProfile,
} from "../services/profile";

export default function ProfileScreen() {
  const [name, setName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const loadProfile =
    useCallback(async () => {
      setLoading(true);

      try {
        const result =
          await getProfile();

        if (!result.success) {
          Alert.alert(
            "Error",
            result.error ??
              "Failed to load profile."
          );
          return;
        }

        if (!result.data) {
          setName("");
          setEmail("");
          return;
        }

        setName(
          result.data.name ?? ""
        );

        setEmail(
          result.data.email ?? ""
        );
      } catch (error) {
        console.error(
          "Profile load error:",
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "Failed to load profile."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveProfile =
    async () => {
      const cleanName =
        name.trim();

      if (!cleanName) {
        Alert.alert(
          "Error",
          "Name is required."
        );
        return;
      }

      if (saving) {
        return;
      }

      setSaving(true);

      try {
        const result =
          await updateProfile({
            name: cleanName,
          });

        if (!result.success) {
          Alert.alert(
            "Error",
            result.error ??
              "Failed to update profile."
          );
          return;
        }

        if (result.data) {
          setName(
            result.data.name ?? ""
          );

          setEmail(
            result.data.email ?? ""
          );
        }

        Alert.alert(
          "Success",
          "Profile updated successfully."
        );
      } catch (error) {
        console.error(
          "Profile update error:",
          error
        );

        Alert.alert(
          "Error",
          error instanceof Error
            ? error.message
            : "Failed to update profile."
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          Profile
        </Text>

        <Text style={styles.label}>
          Name
        </Text>

        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
          editable={!saving}
        />

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          value={email}
          editable={false}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={[
            styles.input,
            styles.disabledInput,
          ]}
        />

        <TouchableOpacity
          style={[
            styles.button,
            saving &&
              styles.disabledButton,
          ]}
          onPress={() => {
            void saveProfile();
          }}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              color="#ffffff"
            />
          ) : (
            <Text
              style={
                styles.buttonText
              }
            >
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 20,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    card: {
      width: "100%",
      maxWidth: 600,
      alignSelf: "center",
    },

    title: {
      fontSize: 28,
      fontWeight: "700",
      marginBottom: 30,
    },

    label: {
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 8,
      marginTop: 16,
    },

    input: {
      width: "100%",
      minHeight: 48,
      borderWidth: 1,
      borderColor: "#d1d5db",
      borderRadius: 10,
      paddingHorizontal: 14,
      fontSize: 16,
      backgroundColor:
        "#ffffff",
    },

    disabledInput: {
      opacity: 0.65,
    },

    button: {
      minHeight: 48,
      marginTop: 28,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        "#111827",
    },

    disabledButton: {
      opacity: 0.6,
    },

    buttonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "600",
    },
  });
