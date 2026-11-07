-- CREOVA AI chat: the live chat_messages table was missing generation_id, so every
-- cloud sync failed with "Could not find the 'generation_id' column of 'chat_messages'".
-- This restores the column exactly as defined in 20261006_ai_assistant_foundation.sql.
-- Safe to run more than once.

alter table public.chat_messages
  add column if not exists generation_id uuid null
  references public.generation_history(id)
  on delete set null;

create unique index if not exists chat_messages_generation_unique_idx
on public.chat_messages (generation_id)
where generation_id is not null;

-- Make the API see the new column immediately.
notify pgrst, 'reload schema';
