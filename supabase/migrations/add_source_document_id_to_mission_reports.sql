-- Mettre à jour la vue mission_reports pour ajouter la colonne source_document_id
-- La colonne existe déjà dans la table missions, il suffit de l'exposer dans la vue

-- Supprimer la vue existante (les dépendances seront recréées automatiquement)
DROP VIEW IF EXISTS public.mission_reports;

-- Recréer la vue avec la nouvelle colonne source_document_id
CREATE VIEW public.mission_reports AS
SELECT
  m.id,
  m.date,
  m.start_time,
  m.end_time,
  m.duration,
  m.client_id,
  m.client_name,
  m.provider_id,
  m.provider_name,
  m.service,
  m.status,
  m.color,
  m.report_sent,
  m.source_document_id,
  COALESCE(array_length(m.start_photos, 1), 0) AS start_photos_count,
  COALESCE(array_length(m.end_photos, 1), 0) AS end_photos_count,
  (m.start_video IS NOT NULL AND m.start_video <> '') AS has_start_video,
  (m.end_video IS NOT NULL AND m.end_video <> '') AS has_end_video
FROM public.missions m
WHERE m.status = 'completed';

-- Accorder les permissions sur la vue
GRANT SELECT ON public.mission_reports TO authenticated;
GRANT SELECT ON public.mission_reports TO anon;
