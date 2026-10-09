import { supabase } from "./supabase";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessageType =
  | "text"
  | "voice"
  | "image"
  | "file";

export interface AIMessage {
  role: ChatRole;
  content: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  generation_id: string | null;
  role: ChatRole;
  content: string;
  message_type: ChatMessageType;
  audio_url: string | null;
  audio_duration_ms: number | null;
  created_at: string;
}

export interface ChatResult {
  success: boolean;
  text?: string;
  content?: string;
  model?: string;
  generationId?: string;
  conversationId?: string;
  error?: string;
  usage?: unknown;
}

export async function listConversations(): Promise<ChatConversation[]> {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("User is not authenticated.");
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .select(
      "id,user_id,title,created_at,updated_at",
    )
    .eq("user_id", userData.user.id)
    .order("updated_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createConversation(
  title = "New chat",
): Promise<ChatConversation> {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("User is not authenticated.");
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({
      user_id: userData.user.id,
      title,
    })
    .select(
      "id,user_id,title,created_at,updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(
      [
        "id",
        "conversation_id",
        "user_id",
        "generation_id",
        "role",
        "content",
        "message_type",
        "audio_url",
        "audio_duration_ms",
        "created_at",
      ].join(","),
    )
    .eq("conversation_id", conversationId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const messages = (data ?? []) as ChatMessage[];

  const voicePaths = messages.filter(
    (message) =>
      message.message_type === "voice" &&
      message.audio_url,
  );

  if (voicePaths.length === 0) {
    return messages;
  }

  const signedMessages = await Promise.all(
    messages.map(async (message) => {
      if (
        message.message_type !== "voice" ||
        !message.audio_url
      ) {
        return message;
      }

      const { data: signed, error: signedError } =
        await supabase.storage
          .from("generation-assets")
          .createSignedUrl(
            message.audio_url,
            60 * 60,
          );

      if (signedError || !signed?.signedUrl) {
        console.error(
          "Failed to sign voice message URL:",
          signedError,
        );

        return message;
      }

      return {
        ...message,
        audio_url: signed.signedUrl,
      };
    }),
  );

  return signedMessages;
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId);

  if (error) {
    throw error;
  }
}

export async function generateChat(
  message: string,
  history: AIMessage[] = [],
  conversationId?: string,
): Promise<ChatResult> {
  const { data, error } =
    await supabase.functions.invoke(
      "gemini-chat",
      {
        body: {
          prompt: message,
          history,
          generationType: "chat",
          conversationId,
        },
      },
    );

  if (error) {
    throw error;
  }

  return data as ChatResult;
}

export async function sendMessage(
  message: string,
  history: AIMessage[] = [],
  conversationId?: string,
): Promise<ChatResult> {
  return generateChat(
    message,
    history,
    conversationId,
  );
}

export async function uploadVoiceMessage(
  conversationId: string,
  fileUri: string,
  durationMs: number,
): Promise<ChatMessage> {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!userData.user) {
    throw new Error("User is not authenticated.");
  }

  const userId = userData.user.id;

  const response = await fetch(fileUri);

  if (!response.ok) {
    throw new Error(
      "Unable to read recorded audio.",
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  const filePath =
    `${userId}/${conversationId}/${Date.now()}.m4a`;

  const { error: uploadError } =
    await supabase.storage
      .from("generation-assets")
      .upload(
        filePath,
        arrayBuffer,
        {
          contentType: "audio/mp4",
          upsert: false,
        },
      );

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } =
    await supabase.functions.invoke(
      "chat-voice-message",
      {
        body: {
          conversationId,
          filePath,
          durationMs,
        },
      },
    );

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error(
      data?.error ??
        "Unable to save voice message.",
    );
  }

  return data as ChatMessage;
}
