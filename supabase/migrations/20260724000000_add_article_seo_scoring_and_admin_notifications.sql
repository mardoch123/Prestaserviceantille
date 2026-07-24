-- Migration pour ajouter le barème SEO IA, le rapport de qualité, les catégories, visuels et notifications admin

-- 1. Ajout des colonnes au tableau articles
alter table public.articles 
  add column if not exists seo_score integer default 75 check (seo_score >= 0 and seo_score <= 100),
  add column if not exists quality_report jsonb default '{}'::jsonb,
  add column if not exists category text default 'Conseils Quotidien',
  add column if not exists image_url text;

-- 2. Création de la table de notifications administrateur si non existante
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type text not null default 'article_review',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Accorder les permissions requises
grant select, insert, update, delete on public.admin_notifications to anon, authenticated, service_role;
grant select, insert, update, delete on public.articles to anon, authenticated, service_role;

-- 3. Activation de RLS sur articles
alter table public.articles enable row level security;

-- Accès public en lecture seule pour tous les articles publiés (visiteurs anonymes & clients)
drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles"
  on public.articles for select
  using (status = 'published');

-- Accès complet de gestion pour les utilisateurs authentifiés (administrateurs)
drop policy if exists "Admins can manage articles" on public.articles;
create policy "Admins can manage articles"
  on public.articles for all to authenticated
  using (true)
  with check (true);

-- 4. RLS sur admin_notifications
alter table public.admin_notifications enable row level security;

drop policy if exists "Admins can view and manage notifications" on public.admin_notifications;
create policy "Admins can view and manage notifications"
  on public.admin_notifications for all
  using (true)
  with check (true);
