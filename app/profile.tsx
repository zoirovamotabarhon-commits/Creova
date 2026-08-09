import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  getProfile,
  updateProfile,
} from "../services/profile";
import { getCurrentUser } from "../services/user";

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const user = await getCurrentUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setEmail(user.email);
      setName(user.name ?? "");

      const profile = await getProfile(user.id);

      if (profile) {
        setName(profile.name ?? user.name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
      }
    } catch (error) {
      Alert.alert(
        "CREOVA",
        error instanceof Error
          ? error.message
          : "Profilni yuklashda xatolik yuz berdi."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      return;
    }

    setSaving(true);

    try {
      await updateProfile(userId, {
        name: name.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        email,
      });

      Alert.alert(
        "CREOVA",
        "Profil muvaffaqiyatli saqlandi."
      );
    } catch (error) {
      Alert.alert(
        "Xatolik",
        error instanceof Error
          ? error.message
          : "Profilni saqlashda xatolik yuz berdi."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#60A5FA" size="large" />
        <Text style={styles.loadingText}>
          Profil yuklanmoqda...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <Text style={styles.subtitle}>
        CREOVA profilingiz
      </Text>

      <Text style={styles.label}>Email</Text>

      <TextInput
        style={styles.input}
        value={email}
        editable={false}
        placeholder="Email"
        placeholderTextColor="#64748B"
      />

      <Text style={styles.label}>Ism</Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Ismingiz"
        placeholderTextColor="#64748B"
        editable={!saving}
      />

      <Text style={styles.label}>Avatar URL</Text>

      <TextInput
        style={styles.input}
        value={avatarUrl}
        onChangeText={setAvatarUrl}
        placeholder="https://..."
        placeholderTextColor="#64748B"
        autoCapitalize="none"
        editable={!saving}
      />

      <Pressable
        style={[
          styles.saveButton,
          saving && styles.disabledButton,
        ]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>
            Saqlash
          </Text>
        )}
      </Pressable>

      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
        disabled={saving}
      >
        <Text style={styles.backButtonText}>
          Orqaga
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    padding: 20,
    paddingTop: 60,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "#94A3B8",
    marginTop: 12,
    fontSize: 15,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    color: "#94A3B8",
    fontSize: 16,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 28,
  },

  label: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 7,
    marginTop: 10,
  },

  input: {
    height: 52,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    color: "#FFFFFF",
    paddingHorizontal: 14,
    fontSize: 16,
  },

  saveButton: {
    height: 52,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  backButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  backButtonText: {
    color: "#CBD5E1",
    fontSize: 16,
    fontWeight: "600",
  },
});
