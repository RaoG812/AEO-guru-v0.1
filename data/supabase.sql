-- Table to store user projects referenced by the dashboard
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  name text,
  root_url text not null,
  sitemap_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_owner_id_project_id_key unique (owner_user_id, project_id)
);

create index if not exists projects_owner_idx on public.projects(owner_user_id);

create or replace function public.touch_projects_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger projects_set_updated
before update on public.projects
for each row
execute function public.touch_projects_updated_at();

alter table public.projects enable row level security;

drop policy if exists "Users select own projects" on public.projects;
create policy "Users select own projects"
  on public.projects
  for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Users insert own projects" on public.projects;
create policy "Users insert own projects"
  on public.projects
  for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users update own projects" on public.projects;
create policy "Users update own projects"
  on public.projects
  for update
  using (auth.uid() = owner_user_id);

drop policy if exists "Users delete own projects" on public.projects;
create policy "Users delete own projects"
  on public.projects
  for delete
  using (auth.uid() = owner_user_id);

-- Create a table to persist project schema definitions per authenticated user
create table if not exists public.project_schemas (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  schema_definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_schemas_owner_idx on public.project_schemas(owner_user_id);
create index if not exists project_schemas_project_idx on public.project_schemas(project_id);

-- Trigger to automatically update the updated_at column
create or replace function public.touch_project_schemas_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger project_schemas_set_updated
before update on public.project_schemas
for each row
execute function public.touch_project_schemas_updated_at();

-- Enable row level security so that every Supabase user only sees their own records
alter table public.project_schemas enable row level security;

drop policy if exists "Users select own project schemas" on public.project_schemas;
create policy "Users select own project schemas"
  on public.project_schemas
  for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Users insert own project schemas" on public.project_schemas;
create policy "Users insert own project schemas"
  on public.project_schemas
  for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Users update own project schemas" on public.project_schemas;
create policy "Users update own project schemas"
  on public.project_schemas
  for update
  using (auth.uid() = owner_user_id);

drop policy if exists "Users delete own project schemas" on public.project_schemas;
create policy "Users delete own project schemas"
  on public.project_schemas
  for delete
  using (auth.uid() = owner_user_id);
