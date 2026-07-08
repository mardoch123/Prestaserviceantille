-- ============================================================
-- Purge automatique des brouillons de devis de plus de 2 jours
-- ============================================================
-- Cette fonction supprime les documents en statut 'draft' créés il y a plus de 2 jours.
-- Elle peut être appelée manuellement ou planifiée via pg_cron.
--
-- Usage manuel :
--   SELECT purge_old_drafts();
--
-- Planification automatique (tous les jours à 3h du matin) :
--   SELECT cron.schedule('purge-old-drafts', '0 3 * * *', 'SELECT purge_old_drafts()');
--
-- Vérifier les jobs planifiés :
--   SELECT * FROM cron.job;
--
-- Supprimer le job planifié :
--   SELECT cron.unschedule('purge-old-drafts');
-- ============================================================

-- 1. Activer pg_cron si disponible (Supabase self-hosted)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Fonction de purge
CREATE OR REPLACE FUNCTION purge_old_drafts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER -- S'exécute avec les privilèges du propriétaire (admin)
AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMPTZ;
BEGIN
    -- Seuil : 2 jours avant maintenant (heure Martinique)
    cutoff_date := NOW() AT TIME ZONE 'America/Martinique' - INTERVAL '2 days';

    -- Supprimer les brouillons de plus de 2 jours
    DELETE FROM documents
    WHERE LOWER(COALESCE(status, '')) = 'draft'
      AND (created_at IS NOT NULL AND created_at < cutoff_date);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE LOG '[PurgeDrafts] % brouillon(s) de plus de 2 jours supprimé(s)', deleted_count;

    RETURN deleted_count;
END;
$$;

-- Commentaire pour documentation
COMMENT ON FUNCTION purge_old_drafts() IS 'Supprime les devis/factures en statut draft créés il y a plus de 2 jours';

-- 3. Planification automatique : tous les jours à 3h du matin
-- Supprime d'abord l'ancien job s'il existe pour éviter les doublons
DO $$
BEGIN
    -- Tenter de supprimer un job existant (ignore si n'existe pas)
    BEGIN
        PERFORM cron.unschedule('purge-old-drafts');
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Job n'existait pas, on continue
    END;

    -- Créer le job planifié
    PERFORM cron.schedule('purge-old-drafts', '0 3 * * *', 'SELECT purge_old_drafts()');
END $$;
