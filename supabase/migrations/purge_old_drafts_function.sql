-- ============================================================
-- Purge automatique des brouillons de devis de plus de 2 jours
-- ============================================================
-- Cette fonction supprime les documents en statut 'draft' créés il y a plus de 2 jours.
-- Elle peut être appelée manuellement ou planifiée via pg_cron.
--
-- Usage :
--   SELECT purge_old_drafts();
--
-- Ou pour planifier automatiquement tous les jours à 3h du matin (heure Martinique) :
--   SELECT cron.schedule('purge-old-drafts', '0 3 * * *', 'America/Martinique', 'SELECT purge_old_drafts()');
-- ============================================================

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
