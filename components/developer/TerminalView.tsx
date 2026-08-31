import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface TerminalLog {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface TerminalViewProps {
  logs: TerminalLog[];
}

export const TerminalView: React.FC<TerminalViewProps> = ({ logs }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.redDot]} />
          <View style={[styles.dot, styles.yellowDot]} />
          <View style={[styles.dot, styles.greenDot]} />
        </View>
        <Text style={styles.headerTitle}>
          {t('code.terminal_title', 'Execution Console')}
        </Text>
      </View>
      <ScrollView style={styles.consoleBody}>
        {logs.length === 0 ? (
          <Text style={styles.emptyLog}>
            {t('code.terminal_empty', 'Console ready. Waiting for execution logs...')}
          </Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.timestamp}>[{log.timestamp}]</Text>
              <Text
                style={[
                  styles.logMessage,
                  log.type === 'error' && styles.errorText,
                  log.type === 'success' && styles.successText,
                  log.type === 'warning' && styles.warningText,
                ]}
              >
                {log.type === 'error' ? '✖ ' : log.type === 'success' ? '✔ ' : '> '}
                {log.message}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d1117',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    height: 140,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#161b22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  redDot: { backgroundColor: '#ff5f56' },
  yellowDot: { backgroundColor: '#ffbd2e' },
  greenDot: { backgroundColor: '#27c93f' },
  headerTitle: {
    color: '#8b949e',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  consoleBody: {
    padding: 10,
  },
  emptyLog: {
    color: '#484f58',
    fontSize: 12,
    fontFamily: 'Platform',
  },
  logRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timestamp: {
    color: '#484f58',
    fontSize: 11,
    fontFamily: 'Platform',
    marginRight: 8,
  },
  logMessage: {
    color: '#c9d1d9',
    fontSize: 12,
    fontFamily: 'Platform',
    flex: 1,
  },
  errorText: { color: '#f85149' },
  successText: { color: '#3fb950' },
  warningText: { color: '#d29922' },
});

