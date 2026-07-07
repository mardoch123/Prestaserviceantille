-- Ajout de la colonne scheduled_unavailabilities à la table providers
-- Permet de stocker des indisponibilités programmées sur N semaines (JSONB)
-- Format: [{ dayOfWeek, startTime, endTime, startDate, weeks }]

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS scheduled_unavailabilities JSONB DEFAULT '[]'::jsonb;
