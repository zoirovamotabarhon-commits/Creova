import React from 'react';
import { View, TextInput, Text, StyleSheet, ScrollView } from 'react-native';

interface CodeEditorProps {
  value: string;
  onChangeText?: (text: string) => void;
  readOnly?: boolean;
  language?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChangeText,
  readOnly = false,
  language = 'typescript',
}) => {
  const lines = value.split('\n');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.languageText}>{language.toUpperCase()}</Text>
      </View>
      <ScrollView horizontal style={styles.scrollContainer}>
        <View style={styles.editorWrapper}>
          {/* Line Numbers */}
          <View style={styles.lineNumbersContainer}>
            {lines.map((_, index) => (
              <Text key={index} style={styles.lineNumber}>
                {index + 1}
              </Text>
            ))}
          </View>

          {/* Code Input / Display */}
          <TextInput
            multiline
            editable={!readOnly}
            value={value}
            onChangeText={onChangeText}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    overflow: 'hidden',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    backgroundColor: '#2d2d2d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#393939',
  },
  languageText: {
    color: '#888',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flexGrow: 0,
  },
  editorWrapper: {
    flexDirection: 'row',
    minWidth: '100%',
    paddingVertical: 8,
  },
  lineNumbersContainer: {
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#333',
    alignItems: 'flex-end',
  },
  lineNumber: {
    color: '#555',
    fontFamily: 'Platform', // Falls back to system monospace
    fontSize: 13,
    lineHeight: 20,
  },
  input: {
    color: '#d4d4d4',
    fontFamily: 'Platform',
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
});
