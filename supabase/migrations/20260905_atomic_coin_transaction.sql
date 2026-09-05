-- ============================================================
-- CREOVA
-- Adds:
--   1. rate_limit_counters + check_and_increment_rate_limit()
--      Backs supabase/functions/_shared/rateLimiter.ts. Edge functions
--      are stateless between calls, so the counter has to live here.
--   2. apply_coin_transactions_batch()
--      Additive to public.change_wallet_balance() from
--      007_coin_operations.sql (not a replacement). Lets a caller run
--      several coin operations as a single all-or-nothing transaction —
--      e.g. a base cost + a surcharge from one hybrid-routed AI request —
--      so a failure partway through never leaves a partial charge.
-- ============================================================

-- ------------------------------------------------------------
-- RATE LIMITING
-- ------------------------------------------------------------

create table if not exists public.rate_limit_counters (
  user_id uuid not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, action, window_start)
);

create index if not exists idx_rate_limit_counters_lookup
  on public.rate_limit_counters (user_id, action, window_start);

alter table public.rate_limit_counters enable row level security;

-- Only server-side (service role) code reads or writes this table;
-- edge functions use the service role key, which bypasses RLS, so no
-- policy needs to grant access to regular users.

create or replace function public.check_and_increment_rate_limit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  -- Bucket the current time into a fixed window, e.g. every 60s.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (user_id, action, window_start, request_count)
  values (p_user_id, p_action, v_window_start, 1)
  on conflict (user_id, action, window_start)
  do update set request_count = public.rate_limit_counters.request_count + 1
  returning request_count into v_count;

  -- Best-effort cleanup of old windows for this user/action so the table
  -- doesn't grow unbounded. Cheap: at most a few rows per call.
  delete from public.rate_limit_counters
  where user_id = p_user_id
    and action = p_action
    and window_start < v_window_start;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

-- ------------------------------------------------------------
-- ATOMIC MULTI-OPERATION COIN TRANSACTION
-- ------------------------------------------------------------

create or replace function public.apply_coin_transactions_batch(
  p_user_id uuid,
  p_operations jsonb
)
returns table (
  wallet_id uuid,
  user_id uuid,
  new_balance bigint,
  transaction_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation jsonb;
  v_result record;
  v_last_wallet_id uuid;
  v_last_balance bigint;
  v_transaction_ids uuid[] := array[]::uuid[];
begin
  if p_operations is null or jsonb_typeof(p_operations) <> 'array' or jsonb_array_length(p_operations) = 0 then
    raise exception 'p_operations must be a non-empty JSON array.';
  end if;

  -- A single PL/pgSQL function call runs in one transaction: if any
  -- operation below raises (e.g. change_wallet_balance rejects an
  -- overdraft), everything already applied in this batch is rolled back
  -- automatically. Callers never see a partially-applied batch.
  for v_operation in select * from jsonb_array_elements(p_operations)
  loop
    select *
    into v_result
    from public.change_wallet_balance(
      p_user_id,
      (v_operation ->> 'amount')::bigint,
      v_operation ->> 'transaction_type',
      v_operation ->> 'reason',
      nullif(v_operation ->> 'reference_id', '')::uuid,
      v_operation ->> 'description',
      coalesce(v_operation -> 'metadata', '{}'::jsonb)
    );

    v_last_wallet_id := v_result.wallet_id;
    v_last_balance := v_result.new_balance;
    v_transaction_ids := array_append(v_transaction_ids, v_result.transaction_id);
  end loop;

  return query
  select v_last_wallet_id, p_user_id, v_last_balance, v_transaction_ids;
end;
$$;
