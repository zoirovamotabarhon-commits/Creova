-- CREOVA AI chat: restore the pieces of the chat schema that were missing on the live
-- database (they are defined in 20261006_ai_assistant_foundation.sql).
-- Safe to run more than once.

create or replace function public.set_ai_assistant_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chat_conversations_updated_at on public.chat_conversations;
create trigger chat_conversations_updated_at
before update on public.chat_conversations
for each row
execute function public.set_ai_assistant_updated_at();

create index if not exists chat_conversations_user_updated_idx
on public.chat_conversations (user_id, updated_at desc);

create index if not exists chat_messages_conversation_created_idx
on public.chat_messages (conversation_id, created_at asc);

create index if not exists chat_messages_user_created_idx
on public.chat_messages (user_id, created_at desc);
