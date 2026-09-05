-- ComplyVision initial Supabase schema
-- Run this migration in the Supabase SQL Editor or via Supabase CLI.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'inspector'
    check (role in ('inspector', 'reviewer', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('PASS', 'FAIL', 'REVIEW')),
  product_name text,
  source_filename text,
  report jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists inspections_user_id_created_at_idx
  on public.inspections (user_id, created_at desc);

create index if not exists inspections_status_idx
  on public.inspections (status);

-- Keep updated_at current for profile edits.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Create a profile automatically for every new Auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Enable RLS on every exposed application table.
alter table public.profiles enable row level security;
alter table public.inspections enable row level security;

-- Least-privilege Data API grants.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.inspections from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.inspections to authenticated;

-- Profiles: users can read and update only their own profile.
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Inspections: each inspector owns their own inspection history.
drop policy if exists "Users can read their own inspections" on public.inspections;
create policy "Users can read their own inspections"
on public.inspections
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own inspections" on public.inspections;
create policy "Users can create their own inspections"
on public.inspections
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own inspections" on public.inspections;
create policy "Users can update their own inspections"
on public.inspections
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own inspections" on public.inspections;
create policy "Users can delete their own inspections"
on public.inspections
for delete
to authenticated
using ((select auth.uid()) = user_id);
