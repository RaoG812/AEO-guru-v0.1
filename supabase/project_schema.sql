-- Create a table that binds a Supabase Auth user to an AEO-guru project schema
create table if not exists public.project_schemas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  project_id text not null,
  project_root_url text not null,
  schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, project_id)
);

alter table public.project_schemas enable row level security;

create policy "Users can read their project schema"
  on public.project_schemas
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their project schema"
  on public.project_schemas
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their project schema"
  on public.project_schemas
  for update
  using (auth.uid() = user_id);
