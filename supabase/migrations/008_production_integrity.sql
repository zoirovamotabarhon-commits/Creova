-- Production integrity additions for CREOVA.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Project',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx
  on public.projects(user_id);

alter table public.projects enable row level security;

drop policy if exists "Users can read own projects"
on public.projects;

create policy "Users can read own projects"
on public.projects
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own projects"
on public.projects;

create policy "Users can create own projects"
on public.projects
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own projects"
on public.projects;

create policy "Users can update own projects"
on public.projects
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own projects"
on public.projects;

create policy "Users can delete own projects"
on public.projects
for delete
using (auth.uid() = user_id);


create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, path)
);

create index if not exists project_files_project_id_idx
  on public.project_files(project_id);

create index if not exists project_files_user_id_idx
  on public.project_files(user_id);

alter table public.project_files enable row level security;

drop policy if exists "Users can read own project files"
on public.project_files;

create policy "Users can read own project files"
on public.project_files
for select
using (auth.uid() = user_id);

drop policy if exists "Users can create own project files"
on public.project_files;

create policy "Users can create own project files"
on public.project_files
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own project files"
on public.project_files;

create policy "Users can update own project files"
on public.project_files
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own project files"
on public.project_files;

create policy "Users can delete own project files"
on public.project_files
for delete
using (auth.uid() = user_id);


create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at
on public.projects;

create trigger projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists project_files_updated_at
on public.project_files;

create trigger project_files_updated_at
before update on public.project_files
for each row
execute function public.set_updated_at();


alter table public.generation_history
  drop constraint if exists generation_history_status_check;

alter table public.generation_history
  add constraint generation_history_status_check
  check (
    status in (
      'queued',
      'processing',
      'completed',
      'failed',
      'cancelled'
    )
  );
