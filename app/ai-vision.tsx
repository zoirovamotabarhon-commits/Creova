import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAI } from '../hooks/useAI';

export default function AIVisionScreen() {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const { messages, loading, error, sendMessage } = useAI();

  const handleAnalyzeVision = async () => {
    if (!prompt.trim()) return;

    let fullInput = prompt;
    if (imageUrl.trim()) {
      fullInput = `[Image: ${imageUrl.trim()}] ${prompt}`;
    }

    await sendMessage(fullInput);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Vision Assistant</Text>

      <ScrollView style={styles.scrollArea}>
        {/* Image Input Section */}
        <Text style={styles.sectionLabel}>Image URL or Source</Text>
        <TextInput
          style={styles.input}
          placeholder="Paste image URL here..."
          placeholderTextColor="#666"
          value={imageUrl}
          onChangeText={setImageUrl}
          autoCapitalize="none"
        />

        {/* Image Preview */}
        {imageUrl.trim() ? (
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {/* Conversation / Results History */}
        <Text style={styles.sectionLabel}>Analysis Results</Text>
        {messages.map((msg, index) => (
          <View
            key={index}
            style={[
              styles.messageBubble,
              msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text style={styles.roleLabel}>
              {msg.role === 'user' ? 'You' : 'Vision AI'}
            </Text>
            <Text style={styles.messageText}>{msg.content}</Text>
          </View>
        ))}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      {/* Input Prompt Section */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.promptInput}
          placeholder="Describe or ask about the image..."
          placeholderTextColor="#666"
          value={prompt}
          onChangeText={setPrompt}
          editable={!loading}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleAnalyzeVision}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Analyze</Text>
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
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#1e1e1e',
    color: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#333',
  },
  previewContainer: {
    marginTop: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  imagePreview: {
    width: '100%',
    height: 180,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: '#1f2937',
    alignSelf: 'flex-end',
    maxWidth: '85%',
  },
  assistantBubble: {
    backgroundColor: '#1e1e1e',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  roleLabel: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
    fontWeight: 'bold',
  },
  messageText: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 20,
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
  promptInput: {
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
    backgroundColor: '#7c3aed',
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

