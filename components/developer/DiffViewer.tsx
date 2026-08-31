import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface DiffLine {
  type: 'add' | 'remove' | 'normal';
  content: string;
}

interface DiffViewerProps {
  originalCode: string;
  modifiedCode: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  originalCode,
  modifiedCode,
}) => {
  // Simple diff generator logic for previewing changes
  const computeDiff = (): DiffLine[] => {
    const origLines = originalCode.split('\n');
    const modLines = modifiedCode.split('\n');
    const diff: DiffLine[] = [];

    const maxLines = Math.max(origLines.length, modLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = origLines[i];
      const modLine = modLines[i];

      if (origLine === modLine) {
        if (origLine !== undefined) {
          diff.push({ type: 'normal', content: origLine });
        }
      } else {
        if (origLine !== undefined) {
          diff.push({ type: 'remove', content: origLine });
        }
        if (modLine !== undefined) {
          diff.push({ type: 'add', content: modLine });
        }
      }
    }

    return diff;
  };

  const diffLines = computeDiff();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Code Changes (Diff)</Text>
      </View>
      <ScrollView horizontal>
        <View style={styles.diffWrapper}>
          {diffLines.map((line, index) => {
            const isAdd = line.type === 'add';
            const isRemove = line.type === 'remove';

            return (
              <View
                key={index}
                style={[
                  styles.lineRow,
                  isAdd && styles.lineAdd,
                  isRemove && styles.lineRemove,
                ]}
              >
                <Text style={styles.prefix}>
                  {isAdd ? '+' : isRemove ? '-' : ' '}
                </Text>
                <Text
                  style={[
                    styles.lineContent,
                    isAdd && styles.textAdd,
                    isRemove && styles.textRemove,
                  ]}
                >
                  {line.content}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181818',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: {
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  diffWrapper: {
    paddingVertical: 4,
    minWidth: '100%',
  },
  lineRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  lineAdd: {
    backgroundColor: 'rgba(46, 160, 67, 0.15)',
  },
  lineRemove: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
  },
  prefix: {
    width: 16,
    color: '#666',
    fontSize: 12,
  },
  lineContent: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'Platform',
  },
  textAdd: {
    color: '#7ee787',
  },
  textRemove: {
    color: '#ffa198',
  },
});
