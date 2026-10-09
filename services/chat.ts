import { createGeneration } from "./generation";
import { invokeEdgeFunction } from "./edgeFunctions";
import { supabase } from "./supabase";

export type ChatRole = "user" | "assistant" | "system";
export type ChatMessageType = "text" | "voice" | "image" | "file";

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
  generationId?: string;
  message?: string;
  error?: string;
  conversationId?: string;
}

export type ChatResponse = ChatResult;

const CONVERSATION_SELECT =
  "id,user_id,title,created_at,updated_at";

const MESSAGE_SELECT =
  "id,conversation_id,user_id,generation_id,role,content,message_type,audio_url,audio_duration_ms,created_at";

export async function listConversations(): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select(CONVERSATION_SELECT)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ChatConversation[];
}

export async function createConversation(
  title = "New chat",
): Promise<ChatConversation> {
  const cleanTitle = title.trim().slice(0, 80) || "New chat";

  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("You must be signed in to create a chat.");
  }

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({
      user_id: userData.user.id,
      title: cleanTitle,
    })
    .select(CONVERSATION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to create chat.");
  }

  return data as ChatConversation;
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const messages = (data ?? []) as ChatMessage[];

  return Promise.all(
    messages.map(async (message) => {
      if (message.message_type !== "voice" || !message.audio_url) {
        return message;
      }

      const { data: signed, error: signedError } =
        await supabase.storage
          .from("generation-assets")
          .createSignedUrl(message.audio_url, 60 * 60);

      if (signedError || !signed?.signedUrl) {
        return message;
      }

      return { ...message, audio_url: signed.signedUrl };
    }),
  );
}

export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", conversationId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function generateChat(
  message: string,
  history: AIMessage[] = [],
  conversationId?: string,
): Promise<ChatResult> {
  const cleanMessage = message.trim();

  if (!cleanMessage) {
    return {
      success: false,
      error: "Message is required.",
      conversationId,
    };
  }

  const generation = await createGeneration(
    "chat",
    undefined,
    cleanMessage,
    { feature: "chat", conversationId },
  );

  if (!generation.success || !generation.generationId) {
    return {
      success: false,
      error:
        generation.error ??
        "Generation could not be created.",
      conversationId,
    };
  }

  const messages: AIMessage[] = [
    ...history
      .filter(
        (item) =>
          item &&
          (item.role === "user" ||
            item.role === "assistant" ||
            item.role === "system") &&
          typeof item.content === "string" &&
          item.content.trim().length > 0,
      )
      .slice(-39),
    {
      role: "user",
      content: cleanMessage,
    },
  ];

  const { data, error } = await invokeEdgeFunction<{
    success: boolean;
    generationId?: string;
    conversationId?: string;
    message?: string;
    text?: string;
    error?: string;
  }>("gemini-chat", {
    body: {
      generationId: generation.generationId,
      generationType: "chat",
      ...(conversationId ? { conversationId } : {}),
      messages,
    },
  });

  if (error) {
    return {
      success: false,
      generationId: generation.generationId,
      error: error.message,
      conversationId,
    };
  }

  if (!data?.success) {
    return {
      success: false,
      generationId: generation.generationId,
      error: data?.error ?? "AI request failed.",
      conversationId,
    };
  }

  return {
    success: true,
    generationId: generation.generationId,
    conversationId: data.conversationId ?? conversationId,
    message: data.message ?? data.text ?? "",
  };
}

export async function sendMessage(
  message: string,
  history: AIMessage[] = [],
  conversationId: string,
): Promise<ChatResult> {
  return generateChat(message, history, conversationId);
}

export async function uploadVoiceMessage(
  conversationId: string,
  fileUri: string,
  durationMs: number,
): Promise<ChatMessage> {
  const { data: userData, error: userError } =
    await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("You must be signed in to send a voice message.");
  }

  const userId = userData.user.id;
  const filePath = `${userId}/${conversationId}/${Date.now()}.m4a`;

  const response = await fetch(fileUri);
  const body = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("generation-assets")
    .upload(filePath, body, {
      contentType: "audio/mp4",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: message, error: messageError } =
    await supabase.functions.invoke<ChatMessage>("chat-voice-message", {
      body: {
        conversationId,
        filePath,
        durationMs: Math.max(0, Math.round(durationMs)),
      },
    });

  if (messageError || !message) {
    throw new Error(
      messageError?.message ?? "Unable to save voice message.",
    );
  }

  return message;
  }
