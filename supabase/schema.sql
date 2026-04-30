-- ============================================================
-- Tables Mycelium — à exécuter dans le SQL Editor Supabase
-- ============================================================

-- user_profile
create table if not exists public.user_profile (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  classe            text check (classe in ('guerrier', 'magicien', 'commercant')),
  cycle_actif       boolean default false,
  quete_active      boolean default false,
  quete_nom         text,
  quete_unite       text,
  onboarding_complete boolean default false,
  created_at        timestamptz default now()
);

-- habitudes
create table if not exists public.habitudes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  nom         text not null,
  type        text not null check (type in ('selfcare', 'responsabilite')),
  difficulte  text not null check (difficulte in ('facile', 'moyen', 'difficile')),
  actif       boolean default true,
  created_at  timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.user_profile enable row level security;
alter table public.habitudes    enable row level security;

-- user_profile policies
create policy "select own profile"
  on public.user_profile for select
  using (auth.uid() = user_id);

create policy "insert own profile"
  on public.user_profile for insert
  with check (auth.uid() = user_id);

create policy "update own profile"
  on public.user_profile for update
  using (auth.uid() = user_id);

-- habitudes policies
create policy "select own habitudes"
  on public.habitudes for select
  using (auth.uid() = user_id);

create policy "insert own habitudes"
  on public.habitudes for insert
  with check (auth.uid() = user_id);

create policy "update own habitudes"
  on public.habitudes for update
  using (auth.uid() = user_id);
