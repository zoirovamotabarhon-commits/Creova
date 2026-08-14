-- ============================================================
-- CREOVA
-- Migration: 007_coin_operations
-- Purpose:
--   Trusted, atomic and idempotent coin operations.
--
-- Security:
--   - Only service_role can change balances.
--   - Wallet row is locked with FOR UPDATE.
--   - Every balance change creates a ledger entry.
--   - Refunds are idempotent by reference_id.
--   - Refund amount must match the original generation debit.
--   - A refund can only target the same user's generation debit.
-- ============================================================


-- ============================================================
-- REFUND IDEMPOTENCY
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

  v_existing_refund_id uuid;
  v_original_debit_amount bigint;
  v_original_debit_user uuid;
  v_original_debit_wallet uuid;
begin

  -- ==========================================================
  -- BASIC VALIDATION
  -- ==========================================================

  if p_user_id is null then
    raise exception 'User ID is required.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception
      'Amount must be greater than zero.';
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
  -- REFUND VALIDATION
  -- ==========================================================

  if p_reason = 'refund'
     and p_reference_id is null then

    raise exception
      'Refund requires a reference ID.';
  end if;


  -- ==========================================================
  -- SECURITY
  -- ==========================================================

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'Only trusted server-side operations may change coin balances.';
  end if;


  -- ==========================================================
  -- GET AND LOCK THE USER WALLET FIRST
  --
  -- This is important for refund idempotency.
  -- Concurrent operations for the same user must serialize
  -- through the same wallet row.
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
  -- REFUND FLOW
  -- ==========================================================

  if p_transaction_type = 'credit'
     and p_reason = 'refund' then

    -- --------------------------------------------------------
    -- Check whether this refund was already completed.
    -- Because the wallet row is locked, concurrent refunds for
    -- the same user are serialized.
    -- --------------------------------------------------------

    select
      ct.id
    into
      v_existing_refund_id
    from public.coin_transactions ct
    where ct.reference_id = p_reference_id
      and ct.transaction_type = 'credit'
      and ct.reason = 'refund'
      and ct.user_id = p_user_id
      and ct.wallet_id = v_wallet_id
    limit 1;

    if v_existing_refund_id is not null then

      return query
      select
        v_existing_refund_id,
        v_wallet_id,
        p_user_id,
        v_current_balance,
        v_current_balance;

      return;
    end if;


    -- --------------------------------------------------------
    -- Find the original generation debit.
    --
    -- A refund must be linked to an existing debit belonging
    -- to the same user and wallet.
    -- --------------------------------------------------------

    select
      abs(ct.amount),
      ct.user_id,
      ct.wallet_id
    into
      v_original_debit_amount,
      v_original_debit_user,
      v_original_debit_wallet
    from public.coin_transactions ct
    where ct.reference_id = p_reference_id
      and ct.transaction_type = 'debit'
      and ct.reason = 'generation'
      and ct.user_id = p_user_id
      and ct.wallet_id = v_wallet_id
    order by ct.created_at asc
    limit 1;

    if v_original_debit_amount is null then
      raise exception
        'Original generation debit was not found for refund.';
    end if;


    -- --------------------------------------------------------
    -- Refund must exactly match the original charge.
    -- --------------------------------------------------------

    if p_amount <> v_original_debit_amount then
      raise exception
        'Refund amount does not match the original generation charge.';
    end if;

  end if;


  -- ==========================================================
  -- CALCULATE BALANCE DELTA
  -- ==========================================================

  if p_transaction_type = 'credit' then
    v_delta := p_amount;
  else
    v_delta := -p_amount;
  end if;

  v_new_balance :=
    v_current_balance + v_delta;


  -- ==========================================================
  -- NEVER ALLOW NEGATIVE BALANCE
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
  -- INSERT IMMUTABLE LEDGER ENTRY
  -- ==========================================================

  begin

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

  exception
    when unique_violation then

      -- ------------------------------------------------------
      -- Defensive race-condition fallback.
      -- If another concurrent refund created the same unique
      -- reference, return the existing refund instead of
      -- failing the whole operation.
      -- ------------------------------------------------------

      if p_transaction_type = 'credit'
         and p_reason = 'refund' then

        select
          ct.id
        into
          v_existing_refund_id
        from public.coin_transactions ct
        where ct.reference_id = p_reference_id
          and ct.transaction_type = 'credit'
          and ct.reason = 'refund'
          and ct.user_id = p_user_id
          and ct.wallet_id = v_wallet_id
        limit 1;

        if v_existing_refund_id is not null then

          -- Restore the wallet mutation that this transaction
          -- attempted before the duplicate was detected.
          update public.wallets
          set
            balance = v_current_balance,
            updated_at = now()
          where id = v_wallet_id;

          return query
          select
            v_existing_refund_id,
            v_wallet_id,
            p_user_id,
            v_current_balance,
            v_current_balance;

          return;
        end if;
      end if;

      raise;

  end;


  -- ==========================================================
  -- RETURN OPERATION RESULT
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
-- FUNCTION SECURITY
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
  'Trusted atomic CREOVA coin operation. Wallet changes and ledger writes are transactional. Generation refunds are validated against the original generation debit and are idempotent by reference_id.';
