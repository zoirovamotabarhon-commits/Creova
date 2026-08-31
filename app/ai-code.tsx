import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAI } from '../hooks/useAI';
import { CodeEditor } from '../components/developer/CodeEditor';
import { DiffViewer } from '../components/developer/DiffViewer';

export default function AICodeScreen() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState<string>('');
  const [code, setCode] = useState<string>(
    '// Welcome to Creova AI Code Editor\nfunction greet() {\n  console.log("Hello, World!");\n}'
  );
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [modifiedCode, setModifiedCode] = useState<string>('');

  const { messages, loading, error, sendMessage } = useAI();

  const handleGenerateCode = async () => {
    if (!prompt.trim()) return;

    const fullPrompt = `Here is my current code:\n\`\`\`typescript\n${code}\n\`\`\`\nTask: ${prompt}`;
    const response = await sendMessage(fullPrompt);

    if (response?.content) {
      setModifiedCode(response.content);
      setShowDiff(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('code.title', 'AI Code Studio')}</Text>

      <ScrollView style={styles.scrollArea}>
        <Text style={styles.sectionLabel}>
          {t('code.workspace_editor', 'Workspace Editor')}
        </Text>
        <CodeEditor
          value={code}
          onChangeText={setCode}
          language="typescript"
        />

        {showDiff && (
          <View style={styles.diffContainer}>
            <Text style={styles.sectionLabel}>
              {t('code.proposed_changes', 'Proposed AI Changes')}
            </Text>
            <DiffViewer originalCode={code} modifiedCode={modifiedCode} />
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                setCode(modifiedCode);
                setShowDiff(false);
              }}
            >
              <Text style={styles.applyButtonText}>
                {t('code.apply_changes', 'Apply Changes')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={t('code.prompt_placeholder', 'Ask AI to write or refactor code...')}
          placeholderTextColor="#666"
          value={prompt}
          onChangeText={setPrompt}
          editable={!loading}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleGenerateCode}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>
              {t('common.generate', 'Generate')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  scrollArea: {
    flex: 1,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  diffContainer: {
    marginTop: 12,
  },
  applyButton: {
    backgroundColor: '#2e7d32',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginVertical: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  errorText: {
    color: '#ff5252',
    marginVertical: 8,
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#007acc',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
