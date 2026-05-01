-- ============================================================
-- Tables Mycelium — idempotent, ré-exécutable sans erreur
-- ============================================================

-- user_profile
create table if not exists public.user_profile (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  classe              text check (classe in ('guerrier', 'magicien', 'commercant')),
  cycle_actif         boolean default false,
  cycle_debut         date,
  quete_active        boolean default false,
  quete_nom           text,
  quete_unite         text,
  onboarding_complete boolean default false,
  created_at          timestamptz default now()
);

alter table public.user_profile add column if not exists cycle_debut date;

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

-- journal
create table if not exists public.journal (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  sommeil           numeric,
  humeur            smallint check (humeur between 1 and 10),
  journee_difficile boolean default false,
  quete_valeur      numeric,
  tracker4_nom      text,
  tracker4_valeur   numeric,
  journee_minimum   text[] default '{}',
  pts_gagnes_jour   integer default 0,
  xp_gagnes_jour    integer default 0,
  created_at        timestamptz default now(),
  unique (user_id, date)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.user_profile enable row level security;
alter table public.habitudes    enable row level security;
alter table public.journal      enable row level security;

-- ── user_profile ─────────────────────────────────────────────────────────────

drop policy if exists "select own profile" on public.user_profile;
create policy "select own profile"
  on public.user_profile for select
  using (auth.uid() = user_id);

drop policy if exists "insert own profile" on public.user_profile;
create policy "insert own profile"
  on public.user_profile for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own profile" on public.user_profile;
create policy "update own profile"
  on public.user_profile for update
  using (auth.uid() = user_id);

-- ── habitudes ─────────────────────────────────────────────────────────────────

drop policy if exists "select own habitudes" on public.habitudes;
create policy "select own habitudes"
  on public.habitudes for select
  using (auth.uid() = user_id);

drop policy if exists "insert own habitudes" on public.habitudes;
create policy "insert own habitudes"
  on public.habitudes for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own habitudes" on public.habitudes;
create policy "update own habitudes"
  on public.habitudes for update
  using (auth.uid() = user_id);

-- ── journal ───────────────────────────────────────────────────────────────────

drop policy if exists "select own journal" on public.journal;
create policy "select own journal"
  on public.journal for select
  using (auth.uid() = user_id);

drop policy if exists "insert own journal" on public.journal;
create policy "insert own journal"
  on public.journal for insert
  with check (auth.uid() = user_id);

drop policy if exists "update own journal" on public.journal;
create policy "update own journal"
  on public.journal for update
  using (auth.uid() = user_id);
