-- ============================================================
-- CREOVA
-- Migration: 007_coin_operations
-- Purpose:
--   Trusted server-side atomic coin operations.
--
-- Security:
--   - Mobile/authenticated clients cannot execute this function.
--   - Only trusted service-role backend can change balances.
--   - Wallet row is locked during the operation.
--   - Balance update and transaction ledger insert happen in
--     the same database transaction.
-- ============================================================


-- ============================================================
-- FUNCTION
-- ============================================================

create or replace function public.change_wallet_balance(
  p_user_id uuid,
  p_amount bigint,
  p_transaction_type text,
  p_reason text,
  p_reference_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  transaction_id uuid,
  wallet_id uuid,
  user_id uuid,
  previous_balance bigint,
  new_balance bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_current_balance bigint;
  v_new_balance bigint;
  v_transaction_id uuid;
  v_delta bigint;
begin
  -- ----------------------------------------------------------
  -- Basic validation
  -- ----------------------------------------------------------

  if p_user_id is null then
    raise exception 'User ID is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;

  if p_transaction_type not in (
    'credit',
    'debit'
  ) then
    raise exception
      'Transaction type must be credit or debit.';
  end if;

  if p_reason not in (
    'purchase',
    'bonus',
    'refund',
    'admin_adjustment',
    'generation',
    'subscription',
    'other'
  ) then
    raise exception
      'Invalid coin transaction reason.';
  end if;

  if p_metadata is null then
    p_metadata := '{}'::jsonb;
  end if;

  -- ----------------------------------------------------------
  -- Security
  --
  -- This function is intentionally restricted to trusted
  -- backend/service-role callers.
  -- ----------------------------------------------------------

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'Only trusted server-side operations may change coin balances.';
  end if;

  -- ----------------------------------------------------------
  -- Find and lock wallet.
  --
  -- FOR UPDATE prevents concurrent operations from both using
  -- the same old balance.
  -- ----------------------------------------------------------

  select
    w.id,
    w.balance
  into
    v_wallet_id,
    v_current_balance
  from public.wallets w
  where w.user_id = p_user_id
  for update;

  if v_wallet_id is null then
    raise exception
      'Wallet not found for user.';
  end if;

  -- ----------------------------------------------------------
  -- Calculate delta.
  -- ----------------------------------------------------------

  if p_transaction_type = 'credit' then
    v_delta := p_amount;
  else
    v_delta := -p_amount;
  end if;

  v_new_balance :=
    v_current_balance + v_delta;

  -- ----------------------------------------------------------
  -- Prevent negative wallet balances.
  -- ----------------------------------------------------------

  if v_new_balance < 0 then
    raise exception
      'Insufficient coin balance.';
  end if;

  -- ----------------------------------------------------------
  -- Update wallet.
  -- ----------------------------------------------------------

  update public.wallets
  set
    balance = v_new_balance,
    updated_at = now()
  where id = v_wallet_id;

  -- ----------------------------------------------------------
  -- Write immutable ledger entry.
  -- ----------------------------------------------------------

  insert into public.coin_transactions (
    user_id,
    wallet_id,
    amount,
    transaction_type,
    reason,
    reference_id,
    description,
    metadata
  )
  values (
    p_user_id,
    v_wallet_id,
    v_delta,
    p_transaction_type,
    p_reason,
    p_reference_id,
    p_description,
    p_metadata
  )
  returning id
  into v_transaction_id;

  -- ----------------------------------------------------------
  -- Return operation result.
  -- ----------------------------------------------------------

  return query
  select
    v_transaction_id,
    v_wallet_id,
    p_user_id,
    v_current_balance,
    v_new_balance;
end;
$$;


-- ============================================================
-- SECURITY
--
-- Remove execution from public/authenticated clients.
-- Only service-role backend may invoke this function.
-- ============================================================

revoke all
on function public.change_wallet_balance(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb
)
from public;

revoke all
on function public.change_wallet_balance(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb
)
from authenticated;

grant execute
on function public.change_wallet_balance(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb
)
to service_role;


-- ============================================================
-- COMMENTS
-- ============================================================

comment on function public.change_wallet_balance(
  uuid,
  bigint,
  text,
  text,
  uuid,
  text,
  jsonb
)
is
  'Trusted atomic CREOVA coin balance operation. Updates wallet balance and coin ledger in one transaction and is executable only by service_role.';
