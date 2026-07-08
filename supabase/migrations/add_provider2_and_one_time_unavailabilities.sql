-- Ajout du support double attribution (binôme) et indisponibilités ponctuelles

-- 1. Colonnes pour le 2e prestataire sur les missions
ALTER TABLE missions
ADD COLUMN IF NOT EXISTS provider2_id UUID REFERENCES providers(id),
ADD COLUMN IF NOT EXISTS provider2_name TEXT;

-- 2. Colonne pour les indisponibilités ponctuelles sur les prestataires
ALTER TABLE providers
ADD COLUMN IF NOT EXISTS one_time_unavailabilities JSONB DEFAULT '[]'::jsonb;
