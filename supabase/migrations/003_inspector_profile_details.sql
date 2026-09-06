-- Extended inspector profile information.
-- Email remains managed by Supabase Auth and is intentionally not stored as an editable profile field.

alter table public.profiles
  add column if not exists age integer,
  add column if not exists designation text,
  add column if not exists employee_id text,
  add column if not exists department text,
  add column if not exists qualification text,
  add column if not exists experience_years integer,
  add column if not exists office_location text,
  add column if not exists address text,
  add column if not exists bio text;

alter table public.profiles
  drop constraint if exists profiles_age_check;

alter table public.profiles
  add constraint profiles_age_check
  check (age is null or age between 18 and 100);

alter table public.profiles
  drop constraint if exists profiles_experience_years_check;

alter table public.profiles
  add constraint profiles_experience_years_check
  check (experience_years is null or experience_years between 0 and 80);
