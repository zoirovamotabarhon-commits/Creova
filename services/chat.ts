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
  userMessageSaved?: boolean;
}

export type ChatResponse = ChatResult;

const CONVERSATION_SELECT =
  "id,user_id,title,created_at,updated_at";

const MESSAGE_SELECT =
  "id,conversation_id,user_id,role,content,message_type,audio_url,audio_duration_ms,created_at";

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
    throw new Error("Chat yaratish uchun tizimga kiring.");
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
    throw new Error(error?.message ?? "Chat yaratilmadi.");
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
      error: "Xabar bo'sh.",
      conversationId,
      userMessageSaved: false,
    };
  }

  let activeConversationId = conversationId;
  let userMessageSaved = false;
  let generationId: string | undefined;

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      return {
        success: false,
        error: "Davom etish uchun tizimga kiring.",
        conversationId: activeConversationId,
        userMessageSaved: false,
      };
    }

    const userId = authData.user.id;

    // Chat ID berilmagan bo'lsa, yangi chat yaratamiz.
    if (!activeConversationId) {
      const conversation = await createConversation(cleanMessage);
      activeConversationId = conversation.id;
    }

    // Avval chat egasini va mavjudligini tekshiramiz.
    const { data: conversation, error: conversationError } =
      await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", activeConversationId)
        .eq("user_id", userId)
        .maybeSingle();

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    if (!conversation) {
      throw new Error("Chat topilmadi yoki unga ruxsat yo'q.");
    }

    // MUHIM: savol Gemini chaqirilishidan OLDIN saqlanadi.
    const { error: saveQuestionError } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: activeConversationId,
        user_id: userId,
        role: "user",
        content: cleanMessage,
        message_type: "text",
      });

    if (saveQuestionError) {
      return {
        success: false,
        error: `Savol bazaga saqlanmadi: ${saveQuestionError.message}`,
        conversationId: activeConversationId,
        userMessageSaved: false,
      };
    }

    userMessageSaved = true;

    // Sarlavha yangilanishi xabar saqlanishiga xalaqit bermasligi kerak.
    const { error: titleError } = await supabase
      .from("chat_conversations")
      .update({
        title: cleanMessage.slice(0, 80) || "New chat",
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeConversationId)
      .eq("user_id", userId);

    if (titleError) {
      console.warn("Chat sarlavhasi yangilanmadi:", titleError.message);
    }

    // Generation yaratilmasa ham, savol bazada saqlanib qoladi.
    const generation = await createGeneration(
      "chat",
      undefined,
      cleanMessage,
      {
        feature: "chat",
        conversationId: activeConversationId,
      },
    );

    if (!generation.success || !generation.generationId) {
      return {
        success: false,
        error: generation.error ?? "Generation yaratilmadi.",
        conversationId: activeConversationId,
        userMessageSaved: true,
      };
    }

    generationId = generation.generationId;

    const safeHistory: AIMessage[] = history
      .filter(
        (item) =>
          item &&
          (item.role === "user" ||
            item.role === "assistant" ||
            item.role === "system") &&
          typeof item.content === "string" &&
          item.content.trim().length > 0,
      )
      .slice(-39)
      .map((item) => ({
        role: item.role,
        content: item.content.trim(),
      }));

    // Joriy savol tarixga faqat bir marta qo'shiladi.
    const messages: AIMessage[] = [
      ...safeHistory,
      { role: "user", content: cleanMessage },
    ];

    const { data, error } = await invokeEdgeFunction<{
      success: boolean;
      generationId?: string;
      conversationId?: string;
      message?: string;
      text?: string;
      content?: string;
      error?: string;
    }>("gemini-chat", {
      body: {
        generationId,
        generationType: "chat",
        conversationId: activeConversationId,
        messages,
      },
    });

    if (error) {
      return {
        success: false,
        generationId,
        error: error.message,
        conversationId: activeConversationId,
        userMessageSaved: true,
      };
    }

    if (!data?.success) {
      return {
        success: false,
        generationId,
        error: data?.error ?? "Gemini javob qaytarmadi.",
        conversationId: activeConversationId,
        userMessageSaved: true,
      };
    }

    const answer = data.message ?? data.text ?? data.content ?? "";

    if (!answer.trim()) {
      return {
        success: false,
        generationId,
        error: "Gemini bo'sh javob qaytardi.",
        conversationId: activeConversationId,
        userMessageSaved: true,
      };
    }

    return {
      success: true,
      generationId,
      conversationId: data.conversationId ?? activeConversationId,
      message: answer,
      userMessageSaved: true,
    };
  } catch (error) {
    return {
      success: false,
      generationId,
      error:
        error instanceof Error
          ? error.message
          : "Chatda kutilmagan xatolik yuz berdi.",
      conversationId: activeConversationId,
      userMessageSaved,
    };
  }
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
    throw new Error("Ovozli xabar yuborish uchun tizimga kiring.");
  }

  const userId = userData.user.id;
  const filePath = `${userId}/${conversationId}/${Date.now()}.m4a`;

  const response = await fetch(fileUri);
  if (!response.ok) {
    throw new Error("Ovozli faylni o'qib bo'lmadi.");
  }

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
      messageError?.message ?? "Ovozli xabarni saqlab bo'lmadi.",
    );
  }

  return message;
}
