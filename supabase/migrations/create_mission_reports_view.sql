CREATE OR REPLACE VIEW public.mission_reports AS
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
