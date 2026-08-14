-- ============================================================
-- CREOVA
-- Migration: 007_coin_operations
-- Purpose:
--   Trusted server-side atomic coin operations.
--
-- Security:
--   - Only service_role may execute the function.
--   - Wallet balance changes are atomic.
--   - Wallet row is locked with FOR UPDATE.
--   - Every balance change creates an immutable ledger entry.
--   - Refunds are idempotent by generation reference_id.
-- ============================================================


-- ============================================================
-- IDEMPOTENCY
--
-- A generation may be refunded only once.
--
-- Example:
--   generation ABC -> refund -> +10
--   generation ABC -> refund again -> existing transaction
--                                -> NO second +10
-- ============================================================

create unique index if not exists
  coin_transactions_refund_reference_unique_idx
on public.coin_transactions (
  reference_id
)
where
  reference_id is not null
  and transaction_type = 'credit'
  and reason = 'refund';


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
  v_existing_amount bigint;
begin

  -- ==========================================================
  -- BASIC VALIDATION
  -- ==========================================================

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


  -- ==========================================================
  -- REFERENCE VALIDATION
  --
  -- Refunds must identify the generation/operation they refund.
  -- Without a reference_id a refund cannot be made idempotent.
  -- ==========================================================

  if p_reason = 'refund'
     and p_reference_id is null then
    raise exception
      'Refund requires a reference ID.';
  end if;


  -- ==========================================================
  -- SECURITY
  --
  -- Only trusted backend/service-role callers may change
  -- balances.
  -- ==========================================================

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'Only trusted server-side operations may change coin balances.';
  end if;


  -- ==========================================================
  -- IDEMPOTENT REFUND
  --
  -- If this exact refund already exists, return the existing
  -- transaction instead of creating another credit.
  --
  -- The unique index above protects this at database level.
  -- ==========================================================

  if p_transaction_type = 'credit'
     and p_reason = 'refund'
     and p_reference_id is not null then

    select
      ct.id,
      ct.wallet_id,
      ct.amount
    into
      v_transaction_id,
      v_wallet_id,
      v_existing_amount
    from public.coin_transactions ct
    where ct.reference_id = p_reference_id
      and ct.transaction_type = 'credit'
      and ct.reason = 'refund'
    limit 1;

    if v_transaction_id is not null then

      select
        w.balance
      into
        v_current_balance
      from public.wallets w
      where w.id = v_wallet_id;

      if v_current_balance is null then
        raise exception
          'Wallet not found for existing refund transaction.';
      end if;

      return query
      select
        v_transaction_id,
        v_wallet_id,
        p_user_id,
        v_current_balance,
        v_current_balance;

      return;
    end if;
  end if;


  -- ==========================================================
  -- FIND AND LOCK WALLET
  --
  -- FOR UPDATE prevents concurrent operations from using the
  -- same old balance.
  -- ==========================================================

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


  -- ==========================================================
  -- CALCULATE DELTA
  -- ==========================================================

  if p_transaction_type = 'credit' then
    v_delta := p_amount;
  else
    v_delta := -p_amount;
  end if;

  v_new_balance :=
    v_current_balance + v_delta;


  -- ==========================================================
  -- PREVENT NEGATIVE BALANCE
  -- ==========================================================

  if v_new_balance < 0 then
    raise exception
      'Insufficient coin balance.';
  end if;


  -- ==========================================================
  -- UPDATE WALLET
  -- ==========================================================

  update public.wallets
  set
    balance = v_new_balance,
    updated_at = now()
  where id = v_wallet_id;


  -- ==========================================================
  -- IMMUTABLE LEDGER ENTRY
  -- ==========================================================

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


  -- ==========================================================
  -- RETURN RESULT
  -- ==========================================================

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
-- DOCUMENTATION
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
  'Trusted atomic CREOVA coin operation. Updates wallet and immutable ledger in one transaction. Refunds are idempotent by reference_id and execution is restricted to service_role.';
