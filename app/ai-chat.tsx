import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createConversation,
  deleteConversation,
  getConversationMessages,
  listConversations,
  sendMessage,
} from "../services/chat";

import type {
  ChatConversation,
  ChatMessage,
} from "../services/chat";


export default function AIChatScreen() {
  const [
    conversations,
    setConversations,
  ] =
    useState<
      ChatConversation[]
    >([]);

  const [
    conversationId,
    setConversationId,
  ] =
    useState<
      string | undefined
    >();

  const [
    messages,
    setMessages,
  ] =
    useState<
      ChatMessage[]
    >([]);

  const [
    input,
    setInput,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    loadingHistory,
    setLoadingHistory,
  ] =
    useState(true);

  const [
    sidebarOpen,
    setSidebarOpen,
  ] =
    useState(false);


  const loadConversations =
    useCallback(
      async () => {
        try {
          const result =
            await listConversations();

          setConversations(
            result,
          );

          if (
            result.length > 0 &&
            !conversationId
          ) {
            setConversationId(
              result[0].id,
            );
          }
        } catch (
          error
        ) {
          console.error(
            "Load conversations error:",
            error,
          );
        }
      },
      [
        conversationId,
      ],
    );


  const loadMessages =
    useCallback(
      async (
        id: string,
      ) => {
        setLoadingHistory(
          true,
        );

        try {
          const result =
            await getConversationMessages(
              id,
            );

          setMessages(
            result,
          );
        } catch (
          error
        ) {
          console.error(
            "Load messages error:",
            error,
          );
        } finally {
          setLoadingHistory(
            false,
          );
        }
      },
      [],
    );


  useEffect(
    () => {
      void loadConversations();
    },
    [
      loadConversations,
    ],
  );


  useEffect(
    () => {
      if (
        conversationId
      ) {
        void loadMessages(
          conversationId,
        );
      } else {
        setMessages(
          [],
        );

        setLoadingHistory(
          false,
        );
      }
    },
    [
      conversationId,
      loadMessages,
    ],
  );


  const handleNewChat =
    async () => {
      try {
        const conversation =
          await createConversation();

        setConversations(
          (
            previous,
          ) => [
            conversation,
            ...previous,
          ],
        );

        setConversationId(
          conversation.id,
        );

        setMessages(
          [],
        );

        setSidebarOpen(
          false,
        );
      } catch (
        error
      ) {
        console.error(
          "New conversation error:",
          error,
        );
      }
    };


  const handleDeleteChat =
    async (
      id: string,
    ) => {
      try {
        await deleteConversation(
          id,
        );

        const remaining =
          conversations.filter(
            (
              item,
            ) =>
              item.id !== id,
          );

        setConversations(
          remaining,
        );

        if (
          conversationId ===
          id
        ) {
          setConversationId(
            remaining[0]?.id,
          );

          if (
            !remaining[0]
          ) {
            setMessages(
              [],
            );
          }
        }
      } catch (
        error
      ) {
        console.error(
          "Delete conversation error:",
          error,
        );
      }
    };


  const handleSend =
    async () => {
      const cleanMessage =
        input.trim();

      if (
        !cleanMessage ||
        loading
      ) {
        return;
      }

      setInput("");

      setLoading(
        true,
      );

      try {
        let activeConversationId =
          conversationId;

        /*
         * First message:
         * create conversation automatically.
         */
        if (
          !activeConversationId
        ) {
          const conversation =
            await createConversation(
              cleanMessage.slice(
                0,
                60,
              ),
            );

          activeConversationId =
            conversation.id;

          setConversationId(
            activeConversationId,
          );

          setConversations(
            (
              previous,
            ) => [
              conversation,
              ...previous,
            ],
          );
        }

        /*
         * Optimistic user message.
         */
        const temporaryUserMessage:
          ChatMessage = {
          id:
            `${Date.now()}-user`,

          conversation_id:
            activeConversationId,

          user_id: "",

          generation_id:
            null,

          role:
            "user",

          content:
            cleanMessage,

          message_type:
            "text",

          created_at:
            new Date().toISOString(),
        };

        setMessages(
          (
            previous,
          ) => [
            ...previous,
            temporaryUserMessage,
          ],
        );

        const history =
          messages.map(
            (
              message,
            ) => ({
              role:
                message.role,

              content:
                message.content,
            }),
          );

        const response =
          await sendMessage(
            cleanMessage,
            history,
            activeConversationId,
          );

        if (
          !response.success
        ) {
          setMessages(
            (
              previous,
            ) => [
              ...previous,
              {
                id:
                  `${Date.now()}-error`,

                conversation_id:
                  activeConversationId!,

                user_id: "",

                generation_id:
                  response.generationId ??
                  null,

                role:
                  "assistant",

                content:
                  response.error ??
                  "AI bilan bog'lanishda xatolik yuz berdi.",

                message_type:
                  "text",

                created_at:
                  new Date().toISOString(),
              },
            ],
          );

          return;
        }

        /*
         * Reload from server.
         *
         * This guarantees that UI and
         * database are synchronized.
         */
        await loadMessages(
          activeConversationId,
        );

        await loadConversations();
      } catch (
        error
      ) {
        console.error(
          "AI chat error:",
          error,
        );

        setMessages(
          (
            previous,
          ) => [
            ...previous,
            {
              id:
                `${Date.now()}-error`,

              conversation_id:
                conversationId ??
                "",

              user_id: "",

              generation_id:
                null,

              role:
                "assistant",

              content:
                error instanceof Error
                  ? error.message
                  : "Kutilmagan xatolik yuz berdi.",

              message_type:
                "text",

              created_at:
                new Date().toISOString(),
            },
          ],
        );
      } finally {
        setLoading(
          false,
        );
      }
    };


  return (
    <KeyboardAvoidingView
      style={
        styles.container
      }
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : "height"
      }
      keyboardVerticalOffset={
        Platform.OS === "ios"
          ? 10
          : 0
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            setSidebarOpen(
              !sidebarOpen,
            )
          }
          style={
            styles.menuButton
          }
        >
          <Text
            style={
              styles.menuText
            }
          >
            ☰
          </Text>
        </Pressable>

        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.title
            }
          >
            🤖 CREOVA AI
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            AI Assistant
          </Text>
        </View>

        <Pressable
          onPress={() => {
            void handleNewChat();
          }}
          style={
            styles.newButton
          }
        >
          <Text
            style={
              styles.newButtonText
            }
          >
            +
          </Text>
        </Pressable>
      </View>


      {sidebarOpen && (
        <View
          style={
            styles.sidebar
          }
        >
          <Text
            style={
              styles.sidebarTitle
            }
          >
            Chat History
          </Text>

          <Pressable
            style={
              styles.newChatButton
            }
            onPress={() => {
              void handleNewChat();
            }}
          >
            <Text
              style={
                styles.newChatText
              }
            >
              + New chat
            </Text>
          </Pressable>

          <FlatList
            data={
              conversations
            }
            keyExtractor={(
              item,
            ) =>
              item.id
            }
            renderItem={({
              item,
            }) => (
              <View
                style={
                  styles.conversationRow
                }
              >
                <Pressable
                  style={
                    styles.conversationButton
                  }
                  onPress={() => {
                    setConversationId(
                      item.id,
                    );

                    setSidebarOpen(
                      false,
                    );
                  }}
                >
                  <Text
                    numberOfLines={
                      1
                    }
                    style={
                      styles.conversationTitle
                    }
                  >
                    {item.title}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void handleDeleteChat(
                      item.id,
                    );
                  }}
                >
                  <Text
                    style={
                      styles.deleteText
                    }
                  >
                    ×
                  </Text>
                </Pressable>
              </View>
            )}
          />
        </View>
      )}


      <FlatList
        data={
          messages
        }
        keyExtractor={(
          item,
          index,
        ) =>
          `${item.id}-${index}`
        }
        style={
          styles.list
        }
        contentContainerStyle={[
          styles.listContent,

          messages.length ===
            0 &&
            styles.emptyContent,
        ]}
        renderItem={({
          item,
        }) => (
          <View
            style={[
              styles.message,

              item.role ===
                "user"
                ? styles.userMessage
                : styles.assistantMessage,
            ]}
          >
            <Text
              style={
                styles.messageRole
              }
            >
              {item.role ===
              "user"
                ? "Siz"
                : "CREOVA AI"}
            </Text>

            <Text
              style={
                styles.messageText
              }
            >
              {item.content}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View
            style={
              styles.empty
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              CREOVA AI
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Men sizning AI
              Assistant'ingizman.
              {"\n\n"}
              Savol bering,
              g'oya bering yoki
              vazifa bering.
            </Text>
          </View>
        }
      />


      {loadingHistory && (
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator />
          <Text
            style={
              styles.loadingText
            }
          >
            Chat yuklanmoqda...
          </Text>
        </View>
      )}


      {loading && (
        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator />
          <Text
            style={
              styles.loadingText
            }
          >
            CREOVA javob
            tayyorlamoqda...
          </Text>
        </View>
      )}


      <View
        style={
          styles.inputArea
        }
      >
        <TextInput
          style={
            styles.input
          }
          value={
            input
          }
          onChangeText={
            setInput
          }
          placeholder="Xabaringizni yozing..."
          placeholderTextColor="#64748B"
          multiline
          editable={
            !loading
          }
        />

        <Pressable
          style={[
            styles.sendButton,

            (!input.trim() ||
              loading) &&
              styles.sendButtonDisabled,
          ]}
          onPress={() => {
            void handleSend();
          }}
          disabled={
            !input.trim() ||
            loading
          }
        >
          <Text
            style={
              styles.sendText
            }
          >
            Yuborish
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}


const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor:
        "#0F172A",
    },

    header: {
      paddingTop: 56,

      paddingHorizontal:
        16,

      paddingBottom: 16,

      borderBottomWidth: 1,

      borderBottomColor:
        "#1E293B",

      flexDirection:
        "row",

      alignItems:
        "center",
    },

    menuButton: {
      width: 42,

      height: 42,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    menuText: {
      color:
        "#FFFFFF",

      fontSize: 24,
    },

    headerText: {
      flex: 1,
    },

    title: {
      color:
        "#FFFFFF",

      fontSize: 24,

      fontWeight:
        "800",
    },

    subtitle: {
      color:
        "#94A3B8",

      marginTop: 3,

      fontSize: 13,
    },

    newButton: {
      width: 42,

      height: 42,

      borderRadius: 21,

      backgroundColor:
        "#2563EB",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    newButtonText: {
      color:
        "#FFFFFF",

      fontSize: 28,
    },

    sidebar: {
      position:
        "absolute",

      top: 120,

      left: 0,

      bottom: 0,

      width: 300,

      zIndex: 20,

      backgroundColor:
        "#111827",

      padding: 16,

      borderRightWidth: 1,

      borderRightColor:
        "#1E293B",
    },

    sidebarTitle: {
      color:
        "#FFFFFF",

      fontSize: 20,

      fontWeight:
        "700",

      marginBottom:
        14,
    },

    newChatButton: {
      padding: 12,

      borderRadius: 10,

      backgroundColor:
        "#1D4ED8",

      marginBottom:
        12,
    },

    newChatText: {
      color:
        "#FFFFFF",

      fontWeight:
        "600",
    },

    conversationRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      borderBottomWidth:
        1,

      borderBottomColor:
        "#1E293B",
    },

    conversationButton: {
      flex: 1,

      paddingVertical:
        13,
    },

    conversationTitle: {
      color:
        "#CBD5E1",

      fontSize: 14,
    },

    deleteText: {
      color:
        "#EF4444",

      fontSize: 22,

      paddingHorizontal:
        8,
    },

    list: {
      flex: 1,
    },

    listContent: {
      padding: 16,

      gap: 12,
    },

    emptyContent: {
      flexGrow: 1,

      justifyContent:
        "center",
    },

    empty: {
      alignItems:
        "center",

      paddingHorizontal:
        30,
    },

    emptyTitle: {
      color:
        "#FFFFFF",

      fontSize: 30,

      fontWeight:
        "800",

      marginBottom:
        12,
    },

    emptyText: {
      color:
        "#94A3B8",

      fontSize: 15,

      lineHeight: 23,

      textAlign:
        "center",
    },

    message: {
      padding: 14,

      borderRadius: 14,

      maxWidth:
        "90%",
    },

    userMessage: {
      alignSelf:
        "flex-end",

      backgroundColor:
        "#1D4ED8",
    },

    assistantMessage: {
      alignSelf:
        "flex-start",

      backgroundColor:
        "#1E293B",
    },

    messageRole: {
      color:
        "#CBD5E1",

      fontSize: 12,

      fontWeight:
        "700",

      marginBottom:
        5,
    },

    messageText: {
      color:
        "#FFFFFF",

      fontSize: 15,

      lineHeight: 22,
    },

    loading: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 8,

      paddingHorizontal:
        16,

      paddingVertical:
        8,
    },

    loadingText: {
      color:
        "#94A3B8",

      fontSize: 13,
    },

    inputArea: {
      flexDirection:
        "row",

      alignItems:
        "flex-end",

      gap: 8,

      padding: 12,

      borderTopWidth: 1,

      borderTopColor:
        "#1E293B",
    },

    input: {
      flex: 1,

      minHeight: 46,

      maxHeight: 130,

      backgroundColor:
        "#1E293B",

      borderRadius: 14,

      color:
        "#FFFFFF",

      paddingHorizontal:
        14,

      paddingVertical:
        12,

      fontSize: 15,
    },

    sendButton: {
      minHeight: 46,

      paddingHorizontal:
        18,

      borderRadius: 14,

      backgroundColor:
        "#2563EB",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    sendButtonDisabled: {
      opacity:
        0.45,
    },

    sendText: {
      color:
        "#FFFFFF",

      fontWeight:
        "700",
    },
  });
