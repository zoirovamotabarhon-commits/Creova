-- ============================================================
-- CREOVA
-- Migration: 002_generation_history
-- Purpose:
--   Secure, immutable generation history for authenticated users.
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

create index if not exists
  generation_history_user_id_idx
on public.generation_history(user_id);

create index if not exists
  generation_history_user_created_idx
on public.generation_history(
  user_id,
  created_at desc
);

create index if not exists
  generation_history_type_idx
on public.generation_history(type);

create index if not exists
  generation_history_status_idx
on public.generation_history(status);

alter table public.generation_history
enable row level security;

-- Remove old client-write policies.
drop policy if exists
  "Users can insert own generation history"
on public.generation_history;

drop policy if exists
  "Users can update own generation history"
on public.generation_history;

drop policy if exists
  "Users can delete own generation history"
on public.generation_history;

drop policy if exists
  "Users can view own generation history"
on public.generation_history;

-- Client may only READ own history.
create policy
  "Users can view own generation history"
on public.generation_history
for select
to authenticated
using (
  auth.uid() = user_id
);

-- No INSERT / UPDATE / DELETE policy for authenticated.
-- Trusted Edge Functions using service_role perform writes.

drop trigger if exists
  generation_history_updated_at
on public.generation_history;

create trigger
  generation_history_updated_at
before update on public.generation_history
for each row
execute function
  public.update_updated_at();

comment on table public.generation_history is
  'Secure CREOVA AI generation history. Client users may read only their own records.';

comment on column public.generation_history.type is
  'chat, code, image, video, music, or voice.';

comment on column public.generation_history.status is
  'queued, processing, completed, failed, or cancelled.';

comment on column public.generation_history.metadata is
  'Provider-specific generation metadata.';
