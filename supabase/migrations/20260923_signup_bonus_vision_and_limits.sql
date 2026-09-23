-- ============================================================
-- CREOVA
-- Migration: 20260923_signup_bonus_vision_and_limits
--
-- Purpose:
--   Fixes three connected bugs found by cross-referencing the
--   client (services/, constants/) against the database layer.
--
-- 1. SIGNUP BONUS
--    handle_new_user_wallet() (003_wallets.sql) always created
--    wallets with balance = 0 and no automatic credit was ever
--    granted anywhere in the codebase. Because
--    create_generation_with_charge() (20260912) debits the
--    wallet BEFORE any generation can run, and
--    public.wallets.balance has a `check (balance >= 0)`
--    constraint, every brand-new user's very first AI request
--    (chat, image, etc.) failed immediately with "Insufficient
--    coin balance." This grants a starter credit, logged as a
--    normal 'bonus' ledger entry so it shows up in the user's
--    transaction history like any other credit.
--
-- 2. VISION GENERATION TYPE WAS NEVER REACHABLE
--    - types/ai.ts / services/generation.ts define
--      GenerationType including 'vision'.
--    - services/featureCosts.ts prices 'vision' at 5 coins.
--    - supabase/functions/openai-chat/index.ts fully implements
--      vision requests (image_url content parts).
--    - supabase/functions/generation-record/index.ts explicitly
--      accepts 'vision' ("Vision is explicitly supported").
--    But:
--      - public.generation_history.type's CHECK constraint
--        (002_generation_history.sql) never listed 'vision'.
--      - create_generation_with_charge()'s p_type whitelist and
--        cost CASE (20260912) never listed 'vision' either.
--    Result: any vision request reached the very last step and
--    was rejected by the database with "Invalid generation
--    type: vision" (or a check-constraint violation), even
--    though every other layer treated it as fully supported.
--    This adds 'vision' everywhere the other generation types
--    are enumerated, at the same 5-coin cost already advertised
--    in services/featureCosts.ts.
--
-- 3. FREE PLAN'S monthlyAiLimit WAS DISPLAY-ONLY
--    constants/plans.ts advertises `monthlyAiLimit: 10` for the
--    free plan and it is surfaced to users via
--    hooks/useSubscription.ts and
--    services/payments/entitlements.ts, but no server-side code
--    ever checked it - only the coin balance was enforced. This
--    makes create_generation_with_charge() also enforce the
--    free plan's monthly cap (10 generations/calendar month),
--    so the number shown in the app is the number actually
--    enforced. Paid plans (premium/pro) are not capped here;
--    they remain governed by their coin balance only.
-- ============================================================


-- ============================================================
-- 1. GENERATION_HISTORY: ALLOW 'vision'
-- ============================================================

alter table public.generation_history
  drop constraint if exists generation_history_type_check;

alter table public.generation_history
  add constraint generation_history_type_check
  check (
    type in (
      'chat',
      'code',
      'image',
      'video',
      'music',
      'voice',
      'vision'
    )
  );


-- ============================================================
-- 2. SIGNUP BONUS
--
-- Re-defines the existing trigger function from 003_wallets.sql.
-- The trigger itself is created in 003_wallets.sql and already
-- points at public.handle_new_user_wallet(), so no
-- `create trigger` is needed here - replacing the function body
-- is enough.
-- ============================================================

create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Starter credit for every new account. Enough for a handful
  -- of generations (e.g. 3 images, or 15 chat messages) so the
  -- very first thing a new user tries doesn't fail on an empty
  -- wallet. Keep in sync with any "welcome bonus" copy in the
  -- app UI if one is added later.
  v_signup_bonus constant bigint := 15;

  v_wallet_id uuid;
begin
  insert into public.wallets (
    user_id,
    balance
  )
  values (
    new.id,
    v_signup_bonus
  )
  on conflict (user_id)
  do nothing
  returning id into v_wallet_id;

  -- v_wallet_id is only set when a row was actually inserted.
  -- If the wallet already existed (on conflict do nothing), we
  -- must NOT log a second bonus ledger entry - that would let a
  -- retried/duplicate auth trigger firing grant free coins more
  -- than once.
  if v_wallet_id is not null then
    insert into public.coin_transactions (
      user_id,
      wallet_id,
      amount,
      transaction_type,
      reason,
      description,
      metadata
    )
    values (
      new.id,
      v_wallet_id,
      v_signup_bonus,
      'credit',
      'bonus',
      'CREOVA signup bonus',
      jsonb_build_object('source', 'signup')
    );
  end if;

  return new;
end;
$$;

comment on function public.handle_new_user_wallet() is
  'Creates a wallet for every new auth.users row and grants a one-time signup bonus, logged as a bonus credit in coin_transactions.';


-- ============================================================
-- 3. create_generation_with_charge:
--    add 'vision' + enforce the free plan's monthly AI limit
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

  v_plan text;
  v_monthly_limit int;
  v_usage_count int;
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
    'voice',
    'vision'
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
  -- Check for an existing row BEFORE charging anything or
  -- counting monthly usage. This must happen first: charging
  -- then failing the insert would silently double-charge a user
  -- who retries the same request.
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
  -- FREE PLAN MONTHLY LIMIT
  --
  -- Mirrors constants/plans.ts -> PLANS.free.monthlyAiLimit.
  -- Only the free plan is capped this way; premium/pro remain
  -- governed purely by coin balance, matching monthlyAiLimit
  -- being effectively unlimited for those tiers today.
  -- ==========================================================

  select s.plan
    into v_plan
  from public.subscriptions s
  where s.user_id = p_user_id
    and s.status in ('active', 'trialing')
  order by s.updated_at desc
  limit 1;

  v_plan := coalesce(v_plan, 'free');

  v_monthly_limit := case v_plan
    when 'free' then 10
    else null
  end;

  if v_monthly_limit is not null then

    select count(*)
      into v_usage_count
    from public.generation_history gh
    where gh.user_id = p_user_id
      and gh.status <> 'failed'
      and gh.created_at >= date_trunc('month', now());

    if v_usage_count >= v_monthly_limit then
      raise exception
        'Monthly AI generation limit (%) reached for the % plan.',
        v_monthly_limit, v_plan
        using errcode = 'P0001';
    end if;

  end if;


  -- ==========================================================
  -- SERVER-SIDE COST TABLE
  --
  -- Mirrors services/featureCosts.ts. Kept in sync manually;
  -- the client value is for display/estimation only and is
  -- never trusted here.
  -- ==========================================================

  v_cost := case p_type
    when 'chat'   then 1
    when 'code'   then 2
    when 'image'  then 5
    when 'video'  then 15
    when 'music'  then 10
    when 'voice'  then 5
    when 'vision' then 5
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

comment on function public.create_generation_with_charge(
  uuid, uuid, text, text, jsonb
) is
  'Atomically enforces the free plan''s monthly limit, charges the caller''s wallet for one AI generation (chat/code/image/video/music/voice/vision) and creates its generation_history row. Trusted server-side only.';
