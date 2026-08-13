-- ============================================================
-- CREOVA
-- Migration: 003_wallets
-- Purpose: One coin wallet per authenticated user.
-- ============================================================

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    not null
    unique
    references auth.users(id)
    on delete cascade,

  balance bigint
    not null
    default 0
    check (balance >= 0),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


-- ============================================================
-- Index
-- ============================================================

create index if not exists
  wallets_user_id_idx
on public.wallets(user_id);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.wallets
enable row level security;


-- ============================================================
-- SELECT
-- Users can read only their own wallet.
-- ============================================================

drop policy if exists
  "Users can view own wallet"
on public.wallets;

create policy
  "Users can view own wallet"
on public.wallets
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- INSERT
-- Users may create only their own wallet.
-- ============================================================

drop policy if exists
  "Users can insert own wallet"
on public.wallets;

create policy
  "Users can insert own wallet"
on public.wallets
for insert
to authenticated
with check (
  auth.uid() = user_id
);


-- ============================================================
-- UPDATE
-- Users can update only their own wallet.
-- The balance can never become negative because of the
-- database CHECK constraint.
-- ============================================================

drop policy if exists
  "Users can update own wallet"
on public.wallets;

create policy
  "Users can update own wallet"
on public.wallets
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
-- Wallet deletion is intentionally disabled for clients.
--
-- Wallets are financial/accounting records and should not be
-- removable directly by an authenticated client.
-- ============================================================

drop policy if exists
  "Users cannot delete wallet"
on public.wallets;


-- ============================================================
-- Updated-at trigger
-- Reuses the shared function from 001_profiles.sql.
-- ============================================================

drop trigger if exists
  wallets_updated_at
on public.wallets;

create trigger
  wallets_updated_at
before update on public.wallets
for each row
execute function
  public.update_updated_at();


-- ============================================================
-- Automatic wallet creation
--
-- Every newly registered Supabase Auth user receives one
-- wallet automatically.
-- ============================================================

create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;


drop trigger if exists
  on_auth_user_created_wallet
on auth.users;

create trigger
  on_auth_user_created_wallet
after insert on auth.users
for each row
execute function
  public.handle_new_user_wallet();


-- ============================================================
-- Existing users
--
-- Create wallets for users who already existed before this
-- migration was installed.
-- ============================================================

insert into public.wallets (user_id)
select id
from auth.users
on conflict (user_id) do nothing;


-- ============================================================
-- Comments
-- ============================================================

comment on table public.wallets is
  'One CREOVA coin wallet per authenticated user.';

comment on column public.wallets.balance is
  'Current available CREOVA coin balance.';

comment on column public.wallets.user_id is
  'Owner of the wallet. Exactly one wallet per user.';
