-- ============================================================
-- CREOVA
-- Migration: 003_wallets
-- Purpose:
--   One protected coin wallet per authenticated user.
--
-- Security:
--   - Client can READ own wallet.
--   - Client cannot INSERT wallets.
--   - Client cannot UPDATE wallets.
--   - Client cannot DELETE wallets.
--   - Wallet creation is performed automatically by a trusted
--     auth trigger.
--   - Balance changes are reserved for trusted server-side
--     coin operations added in later migrations/functions.
-- ============================================================


-- ============================================================
-- TABLE
-- ============================================================

create table if not exists public.wallets (
  id uuid
    primary key
    default gen_random_uuid(),

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
-- INDEX
-- ============================================================

create index if not exists
  wallets_user_id_idx
on public.wallets(user_id);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.wallets
enable row level security;


-- ============================================================
-- REMOVE ANY OLD CLIENT WRITE POLICIES
--
-- Important:
-- Earlier versions allowed authenticated users to INSERT or
-- UPDATE their own wallet. That would allow manipulation of
-- the coin balance from the mobile client.
-- ============================================================

drop policy if exists
  "Users can insert own wallet"
on public.wallets;

drop policy if exists
  "Users can update own wallet"
on public.wallets;

drop policy if exists
  "Users cannot insert wallet"
on public.wallets;

drop policy if exists
  "Users cannot update wallet"
on public.wallets;

drop policy if exists
  "Users cannot delete wallet"
on public.wallets;


-- ============================================================
-- SELECT
--
-- Authenticated users may read only their own wallet.
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
-- No INSERT / UPDATE / DELETE policies are intentionally
-- created for authenticated users.
--
-- Result:
--
--   authenticated client:
--     SELECT  -> allowed for own wallet
--     INSERT  -> denied
--     UPDATE  -> denied
--     DELETE  -> denied
--
--   trusted server / service_role:
--     can manage wallets as required.
-- ============================================================


-- ============================================================
-- UPDATED_AT TRIGGER
--
-- Reuses the shared function created by
-- 001_profiles.sql.
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
-- AUTOMATIC WALLET CREATION
--
-- Every newly created auth.users record receives exactly one
-- wallet with a zero balance.
-- ============================================================

create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallets (
    user_id,
    balance
  )
  values (
    new.id,
    0
  )
  on conflict (user_id)
  do nothing;

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
-- EXISTING USERS
--
-- Creates zero-balance wallets for users who already existed
-- before this migration was installed.
-- ============================================================

insert into public.wallets (
  user_id,
  balance
)
select
  id,
  0
from auth.users
on conflict (user_id)
do nothing;


-- ============================================================
-- COMMENTS
-- ============================================================

comment on table public.wallets is
  'One protected CREOVA coin wallet per authenticated user.';

comment on column public.wallets.balance is
  'Current available CREOVA coin balance. Client users cannot modify this value directly.';

comment on column public.wallets.user_id is
  'Owner of the wallet. Exactly one wallet per authenticated user.';
