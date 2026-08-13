-- ============================================================
-- CREOVA
-- Migration: 002_generation_history
-- Purpose: Store every AI generation owned by the authenticated
--          user and prepare the database for history, billing,
--          and future AI providers.
-- ============================================================

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  type text
    not null
    check (
      type in (
        'chat',
        'code',
        'image',
        'video',
        'music',
        'voice'
      )
    ),

  prompt text
    not null
    default '',

  status text
    not null
    default 'queued'
    check (
      status in (
        'queued',
        'processing',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  result_text text,

  result_url text,

  provider text,

  model text,

  error_message text,

  metadata jsonb
    not null
    default '{}'::jsonb,

  started_at timestamptz,

  completed_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


-- ============================================================
-- Indexes
-- ============================================================

create index if not exists
  generation_history_user_id_idx
on public.generation_history(user_id);

create index if not exists
  generation_history_user_created_idx
on public.generation_history(user_id, created_at desc);

create index if not exists
  generation_history_type_idx
on public.generation_history(type);

create index if not exists
  generation_history_status_idx
on public.generation_history(status);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.generation_history
enable row level security;


-- ============================================================
-- SELECT
-- Users can only read their own generation history.
-- ============================================================

drop policy if exists
  "Users can view own generation history"
on public.generation_history;

create policy
  "Users can view own generation history"
on public.generation_history
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- INSERT
-- Users can only create history records for themselves.
-- ============================================================

drop policy if exists
  "Users can insert own generation history"
on public.generation_history;

create policy
  "Users can insert own generation history"
on public.generation_history
for insert
to authenticated
with check (
  auth.uid() = user_id
);


-- ============================================================
-- UPDATE
-- Users can only update their own records and cannot move a
-- record to another user.
-- ============================================================

drop policy if exists
  "Users can update own generation history"
on public.generation_history;

create policy
  "Users can update own generation history"
on public.generation_history
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


-- ============================================================
-- DELETE
-- Users can delete only their own generation history.
-- ============================================================

drop policy if exists
  "Users can delete own generation history"
on public.generation_history;

create policy
  "Users can delete own generation history"
on public.generation_history
for delete
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- Updated-at trigger
--
-- 001_profiles.sql already creates the shared
-- public.update_updated_at() function.
-- We reuse it here instead of creating another function.
-- ============================================================

drop trigger if exists
  generation_history_updated_at
on public.generation_history;

create trigger
  generation_history_updated_at
before update on public.generation_history
for each row
execute function
  public.update_updated_at();


-- ============================================================
-- Comments
-- ============================================================

comment on table public.generation_history is
  'Stores CREOVA AI generation history for authenticated users.';

comment on column public.generation_history.type is
  'AI generation type: chat, code, image, video, music, or voice.';

comment on column public.generation_history.status is
  'Generation lifecycle status.';

comment on column public.generation_history.result_text is
  'Text result for chat/code generations.';

comment on column public.generation_history.result_url is
  'URL for generated image, video, music, or voice output.';

comment on column public.generation_history.metadata is
  'Additional provider-specific generation metadata.';
