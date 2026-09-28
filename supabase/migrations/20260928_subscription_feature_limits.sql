-- ============================================================
-- CREOVA
-- Migration: 20260928_subscription_feature_limits
--
-- Purpose:
--   Enforce Free / Premium / Pro feature-specific limits
--   server-side.
--
-- FREE
--   chat   = 10 / day
--   image  = 5  / day
--   music  = 1  / month
--   video  = 1  / month
--
-- PREMIUM
--   chat   = 80  / month
--   image  = 30  / month
--   music  = 5   / month
--   video  = 3   / month
--
-- PRO
--   chat   = 300 / month
--   image  = 100 / month
--   music  = 15  / month
--   video  = 10  / month
--
-- code / voice / vision:
--   No subscription-count limit is introduced here.
--   They continue to use the existing coin system.
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

  v_limit integer;
  v_usage_count integer;

  v_period_start timestamptz;
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
      'Invalid generation type: %',
      p_type;
  end if;

  if p_metadata is null then
    p_metadata := '{}'::jsonb;
  end if;


  -- ==========================================================
  -- SECURITY
  -- ==========================================================

  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception
      'Only trusted server-side operations may create charged generations.';
  end if;


  -- ==========================================================
  -- IDEMPOTENCY
  --
  -- Never charge the same generation twice.
  -- ==========================================================

  if exists (
    select 1
    from public.generation_history
    where id = p_generation_id
  ) then
    raise exception
      'Generation % already exists.',
      p_generation_id
      using errcode = '23505';
  end if;


  -- ==========================================================
  -- LOAD ACTIVE SUBSCRIPTION
  --
  -- Lock the subscription row so two simultaneous generation
  -- requests cannot bypass the feature limit.
  -- ==========================================================

  select s.plan
    into v_plan
  from public.subscriptions s
  where s.user_id = p_user_id
    and s.status in (
      'active',
      'trialing'
    )
  order by s.updated_at desc
  limit 1
  for update;

  v_plan := coalesce(
    v_plan,
    'free'
  );


  -- ==========================================================
  -- DETERMINE FEATURE LIMIT
  -- ==========================================================

  v_limit := null;
  v_period_start := null;


  -- ----------------------------------------------------------
  -- CHAT
  -- ----------------------------------------------------------

  if p_type = 'chat' then

    if v_plan = 'free' then

      v_limit := 10;

      v_period_start :=
        date_trunc(
          'day',
          now()
        );

    elsif v_plan = 'premium' then

      v_limit := 80;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    elsif v_plan = 'pro' then

      v_limit := 300;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    end if;

  end if;


  -- ----------------------------------------------------------
  -- IMAGE
  -- ----------------------------------------------------------

  if p_type = 'image' then

    if v_plan = 'free' then

      v_limit := 5;

      v_period_start :=
        date_trunc(
          'day',
          now()
        );

    elsif v_plan = 'premium' then

      v_limit := 30;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    elsif v_plan = 'pro' then

      v_limit := 100;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    end if;

  end if;


  -- ----------------------------------------------------------
  -- MUSIC
  -- ----------------------------------------------------------

  if p_type = 'music' then

    if v_plan = 'free' then

      v_limit := 1;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    elsif v_plan = 'premium' then

      v_limit := 5;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    elsif v_plan = 'pro' then

      v_limit := 15;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    end if;

  end if;


  -- ----------------------------------------------------------
  -- VIDEO
  -- ----------------------------------------------------------

  if p_type = 'video' then

    if v_plan = 'free' then

      v_limit := 1;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    elsif v_plan = 'premium' then

      v_limit := 3;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    elsif v_plan = 'pro' then

      v_limit := 10;

      v_period_start :=
        date_trunc(
          'month',
          now()
        );

    end if;

  end if;


  -- ==========================================================
  -- ENFORCE FEATURE LIMIT
  --
  -- Only chat/image/music/video are subscription-limited.
  -- code/voice/vision remain coin-based.
  -- ==========================================================

  if v_limit is not null then

    select count(*)
      into v_usage_count
    from public.generation_history gh
    where gh.user_id = p_user_id
      and gh.type = p_type
      and gh.status <> 'failed'
      and gh.created_at >= v_period_start;

    if v_usage_count >= v_limit then

      raise exception
        'The % limit (%) for the % plan has been reached.',
        p_type,
        v_limit,
        v_plan
        using errcode = 'P0001';

    end if;

  end if;


  -- ==========================================================
  -- SERVER-SIDE COIN COST
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
  -- CHARGE WALLET
  -- ==========================================================

  perform public.change_wallet_balance(
    p_user_id,
    v_cost,
    'debit',
    'generation',
    p_generation_id,
    format(
      'Charge for %s generation',
      p_type
    ),
    jsonb_build_object(
      'generation_id',
      p_generation_id,
      'plan',
      v_plan
    )
  );


  -- ==========================================================
  -- CREATE GENERATION
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
    coalesce(
      p_prompt,
      ''
    ),
    'queued',
    p_metadata
  )
  returning *
  into v_generation;


  return v_generation;

end;
$$;


comment on function public.create_generation_with_charge(
  uuid,
  uuid,
  text,
  text,
  jsonb
) is
  'CREOVA subscription feature limits plus atomic coin charging. Free: chat 10/day, image 5/day, music 1/month, video 1/month. Premium: 80/30/5/3 monthly. Pro: 300/100/15/10 monthly. Code, voice and vision remain coin-based.';
