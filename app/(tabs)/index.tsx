import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    try {
      router.push(path as any);
    } catch (e) {
      console.warn('Navigatsiya xatoligi:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.headerTitle}>Creova AI Dashboard</Text>
        
        <View style={styles.section}>
          <Text style={styles.mainTitle}>Creova AI Platform</Text>
          <Text style={styles.subtitle}>Select an autonomous AI agent workspace to begin</Text>
        </View>

        <TouchableOpacity style={[styles.card, styles.codeCardBorder]} activeOpacity={0.7} onPress={() => handleNavigate('/code-studio')}>
          <View style={[styles.indicator, styles.codeIndicator]} />
          <Text style={styles.cardTitle}>AI Code Studio</Text>
          <Text style={styles.cardDescription}>Refactor, debug, generate code, and view real-time diffs with Developer Agent.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, styles.visionCardBorder]} activeOpacity={0.7} onPress={() => handleNavigate('/vision-studio')}>
          <View style={[styles.indicator, styles.visionIndicator]} />
          <Text style={styles.cardTitle}>AI Vision Studio</Text>
          <Text style={styles.cardDescription}>Analyze screenshots, design mockups, and convert UI into native components.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, styles.generalCardBorder]} activeOpacity={0.7} onPress={() => handleNavigate('/general-assistant')}>
          <View style={[styles.indicator, styles.generalIndicator]} />
          <Text style={styles.cardTitle}>AI General Assistant</Text>
          <Text style={styles.cardDescription}>General reasoning, thought-partnering, and architecture discussion.</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  scrollContent: { padding: 20 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 24 },
  section: { marginBottom: 20 },
  mainTitle: { fontSize: 26, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#A0A0A0', lineHeight: 20 },
  card: { backgroundColor: '#18181B', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1 },
  codeCardBorder: { borderColor: '#1D4ED8' },
  visionCardBorder: { borderColor: '#6D28D9' },
  generalCardBorder: { borderColor: '#047857' },
  indicator: { width: 32, height: 4, borderRadius: 2, marginBottom: 12 },
  codeIndicator: { backgroundColor: '#3B82F6' },
  visionIndicator: { backgroundColor: '#8B5CF6' },
  generalIndicator: { backgroundColor: '#10B981' },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  cardDescription: { fontSize: 14, color: '#A1A1AA', lineHeight: 20 },
});

