-- ============================================================
-- CREOVA
-- Migration: 20260912_create_generation_with_charge
-- Purpose:
--   Atomically create a generation_history row AND debit the
--   user's wallet for it, in a single trusted transaction.
--
--   This function was being called by
--   supabase/functions/generation-record/index.ts but had never
--   been created, so every AI generation request (chat, code,
--   image, video, music, voice) was failing at the very first
--   step with "function ... does not exist".
--
-- Security:
--   - Only service_role may call this function directly
--     (enforced below, same pattern as change_wallet_balance).
--   - Reuses the existing, already-audited
--     public.change_wallet_balance() for the actual balance
--     change, so wallet-locking / non-negative-balance /
--     ledger-writing logic is not duplicated here.
--   - The coin cost per generation type is looked up
--     server-side (below) and is never trusted from the client,
--     even though services/featureCosts.ts also defines these
--     numbers for the client UI to display estimated cost.
--
-- Idempotency:
--   - If a generation_history row with this id already exists,
--     the function raises BEFORE touching the wallet, so a
--     client retry (e.g. after a dropped network response) can
--     never double-charge the user. The calling edge function
--     already expects this and falls back to reading the
--     existing row when this RPC errors.
-- ============================================================


-- ============================================================
-- FUNCTION
-- ============================================================

create or replace function public.create_generation_with_charge(
  p_generation_id uuid,
  p_user_id uuid,
  p_type text,
  p_prompt text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.generation_history
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost bigint;
  v_generation public.generation_history;
begin

  -- ==========================================================
  -- BASIC VALIDATION
  -- ==========================================================

  if p_generation_id is null then
    raise exception 'Generation ID is required.';
  end if;

  if p_user_id is null then
    raise exception 'User ID is required.';
  end if;

  if p_type not in (
    'chat',
    'code',
    'image',
    'video',
    'music',
    'voice'
  ) then
    raise exception
      'Invalid generation type: %', p_type;
  end if;

  if p_metadata is null then
    p_metadata := '{}'::jsonb;
  end if;


  -- ==========================================================
  -- SECURITY
  --
  -- Same trust boundary as change_wallet_balance(): only the
  -- service_role key (used exclusively by edge functions, never
  -- shipped to the client) may call this.
  -- ==========================================================

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'Only trusted server-side operations may create charged generations.';
  end if;


  -- ==========================================================
  -- IDEMPOTENCY GUARD
  --
  -- Check for an existing row BEFORE charging anything. This
  -- must happen first: charging then failing the insert would
  -- silently double-charge a user who retries the same request.
  -- ==========================================================

  if exists (
    select 1
    from public.generation_history
    where id = p_generation_id
  ) then
    raise exception
      'Generation % already exists.', p_generation_id
      using errcode = '23505';
  end if;


  -- ==========================================================
  -- SERVER-SIDE COST TABLE
  --
  -- Mirrors services/featureCosts.ts. Kept in sync manually;
  -- the client value is for display/estimation only and is
  -- never trusted here.
  -- ==========================================================

  v_cost := case p_type
    when 'chat'  then 1
    when 'code'  then 2
    when 'image' then 5
    when 'video' then 15
    when 'music' then 10
    when 'voice' then 5
  end;


  -- ==========================================================
  -- CHARGE THE WALLET
  --
  -- Reuses the existing atomic, row-locking, ledger-writing
  -- function. Tags the ledger entry with this generation's id
  -- as reference_id so a later refund (on failure) can find and
  -- exactly match this charge.
  -- ==========================================================

  perform public.change_wallet_balance(
    p_user_id,
    v_cost,
    'debit',
    'generation',
    p_generation_id,
    format('Charge for %s generation', p_type),
    jsonb_build_object('generation_id', p_generation_id)
  );


  -- ==========================================================
  -- CREATE THE GENERATION RECORD
  --
  -- Uses the same id the edge function already generated
  -- client-side, so the id stays authoritative end-to-end.
  -- ==========================================================

  insert into public.generation_history (
    id,
    user_id,
    type,
    prompt,
    status,
    metadata
  )
  values (
    p_generation_id,
    p_user_id,
    p_type,
    coalesce(p_prompt, ''),
    'queued',
    p_metadata
  )
  returning * into v_generation;

  return v_generation;

end;
$$;


-- ============================================================
-- COMMENT
-- ============================================================

comment on function public.create_generation_with_charge is
  'Atomically charges the caller''s wallet for one AI generation and creates its generation_history row. Trusted server-side only.';
