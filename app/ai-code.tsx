import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import {
  useTranslation,
} from "react-i18next";

import {
  useAI,
} from "../hooks/useAI";

import {
  useSupabaseRealtime,
} from "../hooks/useSupabaseRealtime";

import {
  CodeEditor,
} from "../components/developer/CodeEditor";

import {
  DiffViewer,
} from "../components/developer/DiffViewer";

import {
  FileTree,
  FileItem,
} from "../components/developer/FileTree";

import {
  TerminalView,
  TerminalLog,
} from "../components/developer/TerminalView";

import {
  getOrCreateDefaultProject,
} from "../services/projects";

export default function AICodeScreen() {
  const {
    t,
  } = useTranslation();

  const [
    prompt,
    setPrompt,
  ] =
    useState<string>("");

  const [
    activeFilePath,
    setActiveFilePath,
  ] =
    useState<string>(
      "src/App.tsx",
    );

  const [
    projectId,
    setProjectId,
  ] =
    useState<string>();

  const [
    workspaceFiles,
    setWorkspaceFiles,
  ] =
    useState<FileItem[]>([
      {
        path:
          "src/App.tsx",
        name:
          "App.tsx",
      },
      {
        path:
          "src/components/Header.tsx",
        name:
          "Header.tsx",
      },
      {
        path:
          "src/services/api.ts",
        name:
          "api.ts",
      },
      {
        path:
          "package.json",
        name:
          "package.json",
      },
    ]);

  const [
    code,
    setCode,
  ] =
    useState<string>(
      '// src/App.tsx\nimport React from "react";\n\nexport default function App() {\n  return <div>Hello Creova AI</div>;\n}',
    );

  const [
    showDiff,
    setShowDiff,
  ] =
    useState<boolean>(
      false,
    );

  const [
    modifiedCode,
    setModifiedCode,
  ] =
    useState<string>("");

  const [
    logs,
    setLogs,
  ] =
    useState<TerminalLog[]>([
      {
        id:
          "1",
        type:
          "info",
        message:
          "Developer Agent workspace initialized.",
        timestamp:
          new Date().toLocaleTimeString(),
      },
    ]);

  const {
    loading,
    error,
    sendMessage,
  } =
    useAI({
      projectId,
    });

  useEffect(() => {
    let mounted =
      true;

    void getOrCreateDefaultProject()
      .then(
        (
          result,
        ) => {
          if (
            mounted &&
            result.success &&
            result.data
          ) {
            setProjectId(
              result.data.id,
            );
          }
        },
      );

    return () => {
      mounted =
        false;
    };
  }, []);

  const addLog = (
    message: string,
    type:
      | "info"
      | "success"
      | "warning"
      | "error" =
      "info",
  ) => {
    setLogs(
      (
        prev,
      ) => [
        ...prev,
        {
          id:
            Date.now().toString(),
          type,
          message,
          timestamp:
            new Date().toLocaleTimeString(),
        },
      ],
    );
  };

  useSupabaseRealtime({
    projectId,

    onFileUpdated:
      (
        payload,
      ) => {
        addLog(
          `Realtime update received for: ${payload.path}`,
          "warning",
        );

        if (
          payload.path ===
          activeFilePath
        ) {
          setCode(
            payload.content,
          );
        }
      },

    onFileInserted:
      (
        payload,
      ) => {
        addLog(
          `New file detected: ${payload.path}`,
          "info",
        );

        setWorkspaceFiles(
          (
            prev,
          ) => [
            ...prev,
            {
              path:
                payload.path,
              name:
                payload.path,
            },
          ],
        );
      },
  });

  const handleSelectFile = (
    path: string,
  ) => {
    setActiveFilePath(
      path,
    );

    setCode(
      `// Content loaded from ${path}\n// Ready for AI modification...`,
    );

    setShowDiff(
      false,
    );

    addLog(
      `Opened file: ${path}`,
      "info",
    );
  };

  const handleGenerateCode =
    async () => {
      if (
        !prompt.trim()
      ) {
        return;
      }

      addLog(
        "Sending request to Developer Agent...",
        "info",
      );

      const fullPrompt =
        `Active File: ${activeFilePath}\n\`\`\`typescript\n${code}\n\`\`\`\nTask: ${prompt}`;

      const response =
        await sendMessage(
          fullPrompt,
        );

      if (
        response?.content
      ) {
        setModifiedCode(
          response.content,
        );

        setShowDiff(
          true,
        );

        addLog(
          "Code proposal generated successfully.",
          "success",
        );
      } else if (
        error
      ) {
        addLog(
          `Execution failed: ${error}`,
          "error",
        );
      }
    };

  const handleApplyChanges =
    () => {
      setCode(
        modifiedCode,
      );

      setShowDiff(
        false,
      );

      addLog(
        `Applied AI changes to ${activeFilePath}`,
        "success",
      );
    };

  return (
    <View
      style={
        styles.container
      }
    >
      <Text
        style={
          styles.title
        }
      >
        {t(
          "code.title",
          "AI Code Studio",
        )}
      </Text>

      <ScrollView
        style={
          styles.scrollArea
        }
      >
        <FileTree
          files={
            workspaceFiles
          }
          activeFilePath={
            activeFilePath
          }
          onSelectFile={
            handleSelectFile
          }
        />

        <Text
          style={
            styles.sectionLabel
          }
        >
          {t(
            "code.workspace_editor",
            "Workspace Editor",
          )}{" "}
          (
          {
            activeFilePath
          }
          )
        </Text>

        <CodeEditor
          value={
            code
          }
          onChangeText={
            setCode
          }
          language="typescript"
        />

        {showDiff && (
          <View
            style={
              styles.diffContainer
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              {t(
                "code.proposed_changes",
                "Proposed AI Changes",
              )}
            </Text>

            <DiffViewer
              originalCode={
                code
              }
              modifiedCode={
                modifiedCode
              }
            />

            <TouchableOpacity
              style={
                styles.applyButton
              }
              onPress={
                handleApplyChanges
              }
            >
              <Text
                style={
                  styles.applyButtonText
                }
              >
                {t(
                  "code.apply_changes",
                  "Apply Changes",
                )}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TerminalView
          logs={
            logs
          }
        />

        {error && (
          <Text
            style={
              styles.errorText
            }
          >
            {
              error
            }
          </Text>
        )}
      </ScrollView>

      <View
        style={
          styles.inputContainer
        }
      >
        <TextInput
          style={
            styles.input
          }
          placeholder={t(
            "code.prompt_placeholder",
            "Ask AI to write or refactor code...",
          )}
          placeholderTextColor="#666"
          value={
            prompt
          }
          onChangeText={
            setPrompt
          }
          editable={
            !loading
          }
        />

        <TouchableOpacity
          style={
            styles.sendButton
          }
          onPress={
            handleGenerateCode
          }
          disabled={
            loading
          }
        >
          {loading ? (
            <ActivityIndicator
              color="#fff"
              size="small"
            />
          ) : (
            <Text
              style={
                styles.sendButtonText
              }
            >
              {t(
                "common.generate",
                "Generate",
              )}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#121212",
      paddingTop: 40,
      paddingHorizontal: 16,
    },

    title: {
      fontSize: 20,
      fontWeight:
        "bold",
      color:
        "#fff",
      marginBottom: 8,
    },

    scrollArea: {
      flex: 1,
    },

    sectionLabel: {
      color:
        "#888",
      fontSize: 12,
      fontWeight:
        "600",
      marginTop: 8,
      marginBottom: 4,
      textTransform:
        "uppercase",
    },

    diffContainer: {
      marginTop: 12,
    },

    applyButton: {
      backgroundColor:
        "#2e7d32",
      paddingVertical:
        8,
      borderRadius: 6,
      alignItems:
        "center",
      marginVertical:
        8,
    },

    applyButtonText: {
      color:
        "#fff",
      fontWeight:
        "600",
      fontSize: 14,
    },

    errorText: {
      color:
        "#ff5252",
      marginVertical:
        8,
      fontSize: 13,
    },

    inputContainer: {
      flexDirection:
        "row",
      paddingVertical:
        12,
      borderTopWidth:
        1,
      borderTopColor:
        "#222",
    },

    input: {
      flex: 1,
      backgroundColor:
        "#1e1e1e",
      color:
        "#fff",
      borderRadius:
        8,
      paddingHorizontal:
        12,
      paddingVertical:
        10,
      fontSize: 14,
      marginRight:
        8,
    },

    sendButton: {
      backgroundColor:
        "#007acc",
      justifyContent:
        "center",
      alignItems:
        "center",
      paddingHorizontal:
        16,
      borderRadius:
        8,
    },

    sendButtonText: {
      color:
        "#fff",
      fontWeight:
        "bold",
      fontSize: 14,
    },
  });
