-- ============================================================
-- CREOVA
-- Migration: 005_subscriptions
-- Purpose: Store one subscription record per user.
-- ============================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    not null
    unique
    references auth.users(id)
    on delete cascade,

  plan text
    not null
    default 'free'
    check (
      plan in (
        'free',
        'premium',
        'pro'
      )
    ),

  status text
    not null
    default 'active'
    check (
      status in (
        'active',
        'trialing',
        'past_due',
        'cancelled',
        'expired'
      )
    ),

  provider text,

  provider_subscription_id text,

  started_at timestamptz
    not null
    default now(),

  current_period_start timestamptz,

  current_period_end timestamptz,

  cancelled_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint subscriptions_period_check
    check (
      current_period_end is null
      or current_period_start is null
      or current_period_end >= current_period_start
    )
);


-- ============================================================
-- Indexes
-- ============================================================

create index if not exists
  subscriptions_user_id_idx
on public.subscriptions(user_id);

create index if not exists
  subscriptions_status_idx
on public.subscriptions(status);

create index if not exists
  subscriptions_period_end_idx
on public.subscriptions(current_period_end);

create unique index if not exists
  subscriptions_provider_subscription_id_idx
on public.subscriptions(provider_subscription_id)
where provider_subscription_id is not null;


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.subscriptions
enable row level security;


-- ============================================================
-- SELECT
-- Users can view only their own subscription.
-- ============================================================

drop policy if exists
  "Users can view own subscription"
on public.subscriptions;

create policy
  "Users can view own subscription"
on public.subscriptions
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- INSERT / UPDATE / DELETE
--
-- Subscription state is controlled by trusted backend/payment
-- logic. The mobile client cannot directly modify it.
-- ============================================================

drop policy if exists
  "Users can insert subscriptions"
on public.subscriptions;

drop policy if exists
  "Users can update subscriptions"
on public.subscriptions;

drop policy if exists
  "Users can delete subscriptions"
on public.subscriptions;


-- ============================================================
-- Updated-at trigger
-- ============================================================

drop trigger if exists
  subscriptions_updated_at
on public.subscriptions;

create trigger
  subscriptions_updated_at
before update on public.subscriptions
for each row
execute function
  public.update_updated_at();


-- ============================================================
-- Automatic FREE subscription
--
-- Every new authenticated user receives a free subscription.
-- Existing users are also backfilled below.
-- ============================================================

create or replace function public.handle_new_user_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    user_id,
    plan,
    status
  )
  values (
    new.id,
    'free',
    'active'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;


drop trigger if exists
  on_auth_user_created_subscription
on auth.users;

create trigger
  on_auth_user_created_subscription
after insert on auth.users
for each row
execute function
  public.handle_new_user_subscription();


-- ============================================================
-- Existing users
-- ============================================================

insert into public.subscriptions (
  user_id,
  plan,
  status
)
select
  id,
  'free',
  'active'
from auth.users
on conflict (user_id) do nothing;


-- ============================================================
-- Comments
-- ============================================================

comment on table public.subscriptions is
  'CREOVA subscription state for authenticated users.';

comment on column public.subscriptions.plan is
  'Current subscription plan: free, premium, or pro.';

comment on column public.subscriptions.status is
  'Current subscription lifecycle status.';

comment on column public.subscriptions.provider is
  'External payment/subscription provider.';

comment on column public.subscriptions.provider_subscription_id is
  'Provider-side subscription identifier.';
