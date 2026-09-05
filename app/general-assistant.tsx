import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function GeneralAssistantScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Orqaga</Text>
        </TouchableOpacity>
        <Text style={styles.title}>AI General Assistant</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.placeholderText}>
          Umumiy AI yordamchi va arxitektura boʻyicha muloqot stantsiyasi.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  backButton: { marginRight: 15, padding: 8, backgroundColor: '#18181B', borderRadius: 6 },
  backText: { color: '#10B981', fontWeight: 'bold' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#A1A1AA', textAlign: 'center', fontSize: 16 },
});

