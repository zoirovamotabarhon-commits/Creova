import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../constants/routes';

export default function DashboardScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const cards = [
    {
      route: ROUTES.CODE.path,
      title: t('dashboard.code_title', 'AI Code Studio'),
      description: t(
        'dashboard.code_desc',
        'Refactor, debug, generate code, and view real-time diffs with Developer Agent.'
      ),
      color: '#007acc',
    },
    {
      route: ROUTES.VISION.path,
      title: t('dashboard.vision_title', 'AI Vision Studio'),
      description: t(
        'dashboard.vision_desc',
        'Analyze screenshots, design mockups, and convert UI into native components.'
      ),
      color: '#7c3aed',
    },
    {
      route: ROUTES.CHAT.path,
      title: t('dashboard.chat_title', 'AI General Assistant'),
      description: t(
        'dashboard.chat_desc',
        'General reasoning, thought-partnering, and architecture discussion.'
      ),
      color: '#059669',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerTitle}>
            {t('dashboard.welcome', 'Creova AI Platform')}
          </Text>
          <Text style={styles.subtitle}>
            {t('dashboard.subtitle', 'Select an autonomous AI agent workspace to begin')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
          activeOpacity={0.8}
          accessibilityLabel={t('navigation.settings', 'Settings')}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {cards.map((card, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.card, { borderColor: card.color }]}
            onPress={() => router.push(card.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.badge, { backgroundColor: card.color }]} />
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDesc}>{card.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: '#2e2e2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  grid: {
    gap: 16,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    position: 'relative',
  },
  badge: {
    height: 4,
    width: 32,
    borderRadius: 2,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 18,
  },
});
