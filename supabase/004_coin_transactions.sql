-- ============================================================
-- CREOVA
-- Migration: 004_coin_transactions
-- Purpose: Immutable ledger for every coin credit/debit.
-- ============================================================

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    not null
    references auth.users(id)
    on delete cascade,

  wallet_id uuid
    not null
    references public.wallets(id)
    on delete cascade,

  amount bigint
    not null
    check (amount <> 0),

  transaction_type text
    not null
    check (
      transaction_type in (
        'credit',
        'debit'
      )
    ),

  reason text
    not null
    check (
      reason in (
        'purchase',
        'bonus',
        'refund',
        'admin_adjustment',
        'generation',
        'subscription',
        'other'
      )
    ),

  reference_id uuid,

  description text,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  constraint coin_transactions_amount_type_check
    check (
      (transaction_type = 'credit' and amount > 0)
      or
      (transaction_type = 'debit' and amount < 0)
    )
);


-- ============================================================
-- Indexes
-- ============================================================

create index if not exists
  coin_transactions_user_id_idx
on public.coin_transactions(user_id);

create index if not exists
  coin_transactions_wallet_id_idx
on public.coin_transactions(wallet_id);

create index if not exists
  coin_transactions_created_at_idx
on public.coin_transactions(created_at desc);

create index if not exists
  coin_transactions_reference_id_idx
on public.coin_transactions(reference_id);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.coin_transactions
enable row level security;


-- ============================================================
-- SELECT
-- Users can view only their own transaction history.
-- ============================================================

drop policy if exists
  "Users can view own coin transactions"
on public.coin_transactions;

create policy
  "Users can view own coin transactions"
on public.coin_transactions
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- INSERT / UPDATE / DELETE
--
-- Client-side modification is intentionally disabled.
--
-- Coin accounting must be performed server-side through
-- trusted Supabase functions.
-- ============================================================

drop policy if exists
  "Users can insert coin transactions"
on public.coin_transactions;

drop policy if exists
  "Users can update coin transactions"
on public.coin_transactions;

drop policy if exists
  "Users can delete coin transactions"
on public.coin_transactions;


-- ============================================================
-- Integrity trigger
--
-- Ensures that the wallet referenced by a transaction belongs
-- to the same authenticated user recorded in user_id.
-- ============================================================

create or replace function public.validate_coin_transaction_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_owner uuid;
begin
  select w.user_id
    into wallet_owner
  from public.wallets w
  where w.id = new.wallet_id;

  if wallet_owner is null then
    raise exception 'Wallet does not exist.';
  end if;

  if wallet_owner <> new.user_id then
    raise exception 'Wallet does not belong to the transaction user.';
  end if;

  return new;
end;
$$;


drop trigger if exists
  validate_coin_transaction_wallet_trigger
on public.coin_transactions;

create trigger
  validate_coin_transaction_wallet_trigger
before insert on public.coin_transactions
for each row
execute function
  public.validate_coin_transaction_wallet();


-- ============================================================
-- Comments
-- ============================================================

comment on table public.coin_transactions is
  'Immutable ledger of CREOVA coin credits and debits.';

comment on column public.coin_transactions.amount is
  'Positive for credits and negative for debits.';

comment on column public.coin_transactions.transaction_type is
  'Transaction direction: credit or debit.';

comment on column public.coin_transactions.reason is
  'Business reason for the coin transaction.';

comment on column public.coin_transactions.reference_id is
  'Optional reference to a generation, payment, refund, or other related record.';
