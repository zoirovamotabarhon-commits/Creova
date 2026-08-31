import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

export interface FileItem {
  path: string;
  name: string;
  isDirectory?: boolean;
}

interface FileTreeProps {
  files: FileItem[];
  activeFilePath?: string;
  onSelectFile: (path: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  activeFilePath,
  onSelectFile,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t('code.file_explorer', 'Project Explorer')}
        </Text>
      </View>
      <ScrollView style={styles.treeContainer}>
        {files.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('code.no_files', 'No files found in workspace')}
          </Text>
        ) : (
          files.map((file, index) => {
            const isActive = file.path === activeFilePath;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.fileRow, isActive && styles.activeFileRow]}
                onPress={() => onSelectFile(file.path)}
              >
                <Text style={styles.fileIcon}>
                  {file.isDirectory ? '📁' : '📄'}
                </Text>
                <Text
                  style={[styles.fileName, isActive && styles.activeFileName]}
                  numberOfLines={1}
                >
                  {file.name || file.path}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181818',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    maxHeight: 200,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#222222',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    color: '#888888',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  treeContainer: {
    paddingVertical: 4,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeFileRow: {
    backgroundColor: 'rgba(0, 122, 204, 0.2)',
  },
  fileIcon: {
    fontSize: 12,
    marginRight: 8,
  },
  fileName: {
    color: '#cccccc',
    fontSize: 13,
    fontFamily: 'Platform',
  },
  activeFileName: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#666666',
    fontSize: 12,
    padding: 12,
    textAlign: 'center',
  },
});
