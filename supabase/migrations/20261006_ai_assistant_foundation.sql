-- ============================================================
-- CREOVA AI ASSISTANT FOUNDATION
-- ============================================================
--
-- Adds:
--   1. Persistent chat conversations
--   2. Persistent chat messages
--   3. Long-term assistant memories
--   4. Generation -> chat message linkage
--
-- The existing:
--   generation_history
--   wallets
--   coin_transactions
--   subscriptions
-- remain the source of truth for billing/usage.
--
-- Supabase Edge Functions use service_role for writes.
-- Clients can only read their own records.
-- ============================================================


-- ============================================================
-- CHAT CONVERSATIONS
-- ============================================================

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null default 'New chat',

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


create index if not exists
  chat_conversations_user_updated_idx
on public.chat_conversations (
  user_id,
  updated_at desc
);


-- ============================================================
-- CHAT MESSAGES
-- ============================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),

  conversation_id uuid not null
    references public.chat_conversations(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  generation_id uuid null
    references public.generation_history(id)
    on delete set null,

  role text not null
    check (
      role in (
        'user',
        'assistant',
        'system'
      )
    ),

  content text not null,

  message_type text not null default 'text'
    check (
      message_type in (
        'text',
        'voice',
        'image',
        'file'
      )
    ),

  created_at timestamptz not null default now()
);


create index if not exists
  chat_messages_conversation_created_idx
on public.chat_messages (
  conversation_id,
  created_at asc
);


create index if not exists
  chat_messages_user_created_idx
on public.chat_messages (
  user_id,
  created_at desc
);


create unique index if not exists
  chat_messages_generation_unique_idx
on public.chat_messages(generation_id)
where generation_id is not null;


-- ============================================================
-- ASSISTANT MEMORY
-- ============================================================

create table if not exists public.assistant_memories (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  memory text not null,

  category text not null default 'general',

  importance smallint not null default 3
    check (
      importance between 1 and 5
    ),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


create index if not exists
  assistant_memories_user_updated_idx
on public.assistant_memories (
  user_id,
  updated_at desc
);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_ai_assistant_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


drop trigger if exists
  chat_conversations_updated_at
on public.chat_conversations;


create trigger
  chat_conversations_updated_at
before update on public.chat_conversations
for each row
execute function public.set_ai_assistant_updated_at();


drop trigger if exists
  assistant_memories_updated_at
on public.assistant_memories;


create trigger
  assistant_memories_updated_at
before update on public.assistant_memories
for each row
execute function public.set_ai_assistant_updated_at();


-- ============================================================
-- ENABLE RLS
-- ============================================================

alter table public.chat_conversations
enable row level security;

alter table public.chat_messages
enable row level security;

alter table public.assistant_memories
enable row level security;


-- ============================================================
-- CONVERSATIONS POLICIES
-- ============================================================

drop policy if exists
  chat_conversations_select_own
on public.chat_conversations;

create policy
  chat_conversations_select_own
on public.chat_conversations
for select
to authenticated
using (
  auth.uid() = user_id
);


drop policy if exists
  chat_conversations_insert_own
on public.chat_conversations;

create policy
  chat_conversations_insert_own
on public.chat_conversations
for insert
to authenticated
with check (
  auth.uid() = user_id
);


drop policy if exists
  chat_conversations_update_own
on public.chat_conversations;

create policy
  chat_conversations_update_own
on public.chat_conversations
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


drop policy if exists
  chat_conversations_delete_own
on public.chat_conversations;

create policy
  chat_conversations_delete_own
on public.chat_conversations
for delete
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- MESSAGE POLICIES
-- ============================================================

drop policy if exists
  chat_messages_select_own
on public.chat_messages;

create policy
  chat_messages_select_own
on public.chat_messages
for select
to authenticated
using (
  auth.uid() = user_id
);


-- Writes are intentionally performed by the
-- trusted Gemini Edge Function.
--
-- No client insert/update/delete policy.


-- ============================================================
-- MEMORY POLICIES
-- ============================================================

drop policy if exists
  assistant_memories_select_own
on public.assistant_memories;

create policy
  assistant_memories_select_own
on public.assistant_memories
for select
to authenticated
using (
  auth.uid() = user_id
);


drop policy if exists
  assistant_memories_delete_own
on public.assistant_memories;

create policy
  assistant_memories_delete_own
on public.assistant_memories
for delete
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on public.chat_conversations
from anon;

revoke all
on public.chat_messages
from anon;

revoke all
on public.assistant_memories
from anon;


grant select
on public.chat_conversations
to authenticated;

grant select
on public.chat_messages
to authenticated;

grant select, delete
on public.assistant_memories
to authenticated;


comment on table public.chat_conversations is
  'Persistent CREOVA AI Assistant conversations.';

comment on table public.chat_messages is
  'Persistent CREOVA AI Assistant messages.';

comment on table public.assistant_memories is
  'Long-term memories used by CREOVA AI Assistant.';
