-- Module autonome : génération quotidienne d'articles.
-- Il n'ajoute aucune dépendance aux composants React existants.

create extension if not exists pgcrypto;

create table if not exists public.article_generation_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  auto_publish boolean not null default true,
  topic text,
  audience text not null default 'Clients potentiels de Presta Services Antilles en Martinique',
  language text not null default 'fr' check (language in ('fr', 'en')),
  tone text not null default 'professionnel, utile et chaleureux',
  min_words integer not null default 700 check (min_words between 300 and 3000),
  max_words integer not null default 1100 check (max_words between 300 and 3000 and max_words >= min_words),
  ai_model text not null default 'deepseek-chat',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

insert into public.article_generation_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  content_markdown text not null,
  seo_title text,
  seo_description text,
  keywords text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'published', 'failed')),
  generated_date date not null unique,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create table if not exists public.article_generation_runs (
  id uuid primary key default gen_random_uuid(),
  scheduled_for date not null unique,
  status text not null check (status in ('processing', 'succeeded', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  article_id uuid references public.articles(id) on delete set null,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_status_published_at_idx
  on public.articles (status, published_at desc);
create index if not exists article_generation_runs_status_idx
  on public.article_generation_runs (status, scheduled_for desc);

create or replace function public.article_automation_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists article_generation_settings_set_updated_at on public.article_generation_settings;
create trigger article_generation_settings_set_updated_at
before update on public.article_generation_settings
for each row execute function public.article_automation_set_updated_at();

drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at
before update on public.articles
for each row execute function public.article_automation_set_updated_at();

drop trigger if exists article_generation_runs_set_updated_at on public.article_generation_runs;
create trigger article_generation_runs_set_updated_at
before update on public.article_generation_runs
for each row execute function public.article_automation_set_updated_at();

-- Réserve une seule exécution par jour. Une exécution échouée peut être relancée,
-- alors qu'une exécution en cours ou réussie ne peut jamais être dupliquée.
create or replace function public.claim_daily_article_generation(p_scheduled_for date)
returns public.article_generation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_run public.article_generation_runs;
begin
  insert into public.article_generation_runs (scheduled_for, status)
  values (p_scheduled_for, 'processing')
  on conflict (scheduled_for) do update
    set status = 'processing',
        attempt_count = public.article_generation_runs.attempt_count + 1,
        error_message = null,
        started_at = now(),
        completed_at = null
    where public.article_generation_runs.status = 'failed'
  returning * into claimed_run;

  return claimed_run;
end;
$$;

revoke all on function public.claim_daily_article_generation(date) from public, anon, authenticated;
grant execute on function public.claim_daily_article_generation(date) to service_role;

alter table public.article_generation_settings enable row level security;
alter table public.articles enable row level security;
alter table public.article_generation_runs enable row level security;

-- Accorder la lecture sur la table articles aux rôles anonyme et authentifié
grant select on public.articles to anon, authenticated;

-- Politique RLS autorisant la lecture de tous les articles publiés
drop policy if exists "Authenticated users can read published articles" on public.articles;
drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles"
  on public.articles for select
  using (status = 'published');
