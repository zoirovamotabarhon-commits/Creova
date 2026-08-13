-- ============================================================
-- CREOVA
-- Migration: 006_admin_roles
-- Purpose: Secure server-side user roles for administration.
-- ============================================================

create table if not exists public.user_roles (
  user_id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  role text
    not null
    default 'user'
    check (
      role in (
        'user',
        'admin'
      )
    ),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now()
);


-- ============================================================
-- Index
-- ============================================================

create index if not exists
  user_roles_role_idx
on public.user_roles(role);


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.user_roles
enable row level security;


-- ============================================================
-- Users can read their own role only.
--
-- No INSERT / UPDATE / DELETE policy is intentionally exposed
-- to normal authenticated clients.
-- ============================================================

drop policy if exists
  "Users can view own role"
on public.user_roles;

create policy
  "Users can view own role"
on public.user_roles
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- Updated-at trigger
-- ============================================================

drop trigger if exists
  user_roles_updated_at
on public.user_roles;

create trigger
  user_roles_updated_at
before update on public.user_roles
for each row
execute function
  public.update_updated_at();


-- ============================================================
-- Automatic default role
--
-- Every newly registered user receives the normal "user" role.
-- ============================================================

create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (
    user_id,
    role
  )
  values (
    new.id,
    'user'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;


drop trigger if exists
  on_auth_user_created_role
on auth.users;

create trigger
  on_auth_user_created_role
after insert on auth.users
for each row
execute function
  public.handle_new_user_role();


-- ============================================================
-- Existing users
--
-- Backfill the default "user" role for accounts that already
-- existed before this migration.
-- ============================================================

insert into public.user_roles (
  user_id,
  role
)
select
  id,
  'user'
from auth.users
on conflict (user_id) do nothing;


-- ============================================================
-- Secure helper function
--
-- Used by trusted backend code to determine whether the
-- currently authenticated user is an administrator.
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;


-- ============================================================
-- Restrict helper function execution
-- ============================================================

revoke all
on function public.is_admin()
from public;

grant execute
on function public.is_admin()
to authenticated;


-- ============================================================
-- Comments
-- ============================================================

comment on table public.user_roles is
  'Secure CREOVA user roles used for authorization.';

comment on column public.user_roles.role is
  'Application role: user or admin.';

comment on function public.is_admin() is
  'Returns true only when the authenticated user has the admin role.';
