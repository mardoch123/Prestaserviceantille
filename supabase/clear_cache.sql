-- ============================================================
-- NETTOYAGE DU CACHE SUPABASE / PRESTASERVICEANTILLES
-- ============================================================
-- Exécuter ce script dans l'éditeur SQL de Supabase Dashboard
-- ou via la CLI : supabase db push < clear_cache.sql
-- ============================================================

-- 1. Recharger le cache du schéma PostgREST
--    Force PostgREST à relire les tables, colonnes, fonctions, vues et politiques RLS.
--    À utiliser après toute modification de schéma ou de politique RLS.
NOTIFY pgrst, 'reload schema';

-- 2. Recharger la configuration PostgREST
--    Prend en compte les nouvelles variables de configuration sans redémarrage.
NOTIFY pgrst, 'reload config';

-- 3. Mettre à jour les statistiques de toutes les tables
--    Permet à l'optimiseur de requêtes d'utiliser des plans d'exécution à jour.
ANALYZE;

-- 4. Nettoyage des lignes mortes et mise à jour des statistiques par table
--    (optionnel — décommenter si nécessaire)
-- VACUUM ANALYZE clients;
-- VACUUM ANALYZE providers;
-- VACUUM ANALYZE missions;
-- VACUUM ANALYZE documents;
-- VACUUM ANALYZE packs;
-- VACUUM ANALYZE contracts;
-- VACUUM ANALYZE reminders;
-- VACUUM ANALYZE expenses;
-- VACUUM ANALYZE messages;
-- VACUUM ANALYZE notifications;
-- VACUUM ANALYZE company_settings;
-- VACUUM ANALYZE visit_scans;
-- VACUUM ANALYZE leaves;

-- 5. Vider le cache de plan de requêtes (si pg_stat_statements est actif)
--    Réinitialise les statistiques d'exécution collectées.
-- SELECT pg_stat_statements_reset();  -- décommenter si l'extension est activée

-- ============================================================
-- NOTE : Le cache côté navigateur (localStorage) est nettoyé
-- automatiquement par la fonction refreshData() du DataContext.
-- ============================================================
