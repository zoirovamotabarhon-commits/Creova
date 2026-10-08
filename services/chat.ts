import {
  invokeEdgeFunction,
} from "./edgeFunctions";

import {
  createGeneration,
} from "./generation";

import {
  supabase,
} from "./supabase";


export interface AIMessage {
  id?: string;

  role:
    | "user"
    | "assistant"
    | "system";

  content: string;

  messageType?:
    | "text"
    | "voice"
    | "image"
    | "file";
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

  role:
    | "user"
    | "assistant"
    | "system";

  content: string;

  message_type:
    | "text"
    | "voice"
    | "image"
    | "file";

  created_at: string;
}


export interface ChatResult {
  success: boolean;

  generationId?: string;

  message?: string;

  error?: string;

  model?: string;

  conversationId?: string;
}


export async function listConversations(): Promise<
  ChatConversation[]
> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "chat_conversations",
      )
      .select(
        "id,user_id,title,created_at,updated_at",
      )
      .order(
        "updated_at",
        {
          ascending: false,
        },
      );

  if (error) {
    throw error;
  }

  return (
    data ?? []
  ) as ChatConversation[];
}


export async function createConversation(
  title = "New chat",
): Promise<ChatConversation> {
  const {
    data: {
      user,
    },
    error:
      authError,
  } =
    await supabase.auth.getUser();

  if (
    authError ||
    !user
  ) {
    throw new Error(
      "You must be signed in.",
    );
  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "chat_conversations",
      )
      .insert({
        user_id:
          user.id,

        title:
          title
            .trim()
            .slice(
              0,
              120,
            ) ||
          "New chat",
      })
      .select(
        "id,user_id,title,created_at,updated_at",
      )
      .single();

  if (error) {
    throw error;
  }

  return data as ChatConversation;
}


export async function getConversationMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "chat_messages",
      )
      .select(
        "id,conversation_id,user_id,generation_id,role,content,message_type,created_at",
      )
      .eq(
        "conversation_id",
        conversationId,
      )
      .order(
        "created_at",
        {
          ascending: true,
        },
      );

  if (error) {
    throw error;
  }

  return (
    data ?? []
  ) as ChatMessage[];
}


export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const {
    error,
  } =
    await supabase
      .from(
        "chat_conversations",
      )
      .delete()
      .eq(
        "id",
        conversationId,
      );

  if (error) {
    throw error;
  }
}


export async function generateChat(
  message: string,
  history: AIMessage[] = [],
  conversationId?: string,
): Promise<ChatResult> {
  const cleanMessage =
    message.trim();

  if (!cleanMessage) {
    return {
      success: false,

      error:
        "Message is required.",
    };
  }

  const generation =
    await createGeneration(
      "chat",
      undefined,
      cleanMessage,
      {
        feature:
          "chat",

        conversationId:
          conversationId ??
          null,
      },
    );

  if (
    !generation.success ||
    !generation.generationId
  ) {
    return {
      success: false,

      error:
        generation.error ??
        "Generation could not be created.",
    };
  }

  const cleanHistory =
    history
      .filter(
        (
          item,
        ) =>
          item &&
          (
            item.role ===
              "user" ||
            item.role ===
              "assistant" ||
            item.role ===
              "system"
          ) &&
          typeof item.content ===
            "string" &&
          item.content
            .trim()
            .length > 0,
      )
      .slice(-39);

  const messages: AIMessage[] = [
    ...cleanHistory,

    {
      role: "user",

      content:
        cleanMessage,
    },
  ];

  const {
    data,
    error,
  } =
    await invokeEdgeFunction<{
      success: boolean;

      message?: string;

      text?: string;

      error?: string;

      model?: string;

      conversationId?: string;
    }>(
      "gemini-chat",
      {
        body: {
          generationId:
            generation.generationId,

          generationType:
            "chat",

          messages,

          conversationId:
            conversationId ??
            undefined,
        },
      },
    );

  if (error) {
    return {
      success: false,

      generationId:
        generation.generationId,

      error:
        error.message,
    };
  }

  if (
    !data?.success
  ) {
    return {
      success: false,

      generationId:
        generation.generationId,

      error:
        data?.error ??
        "AI request failed.",
    };
  }

  return {
    success: true,

    generationId:
      generation.generationId,

    message:
      data.message ??
      data.text ??
      "",

    model:
      data.model,

    conversationId:
      data.conversationId ??
      conversationId,
  };
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
