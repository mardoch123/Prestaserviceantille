-- Migration: Ajout de la colonne availability_hours à la table providers
-- Cette colonne stocke les heures de disponibilité du prestataire au format JSONB

-- Ajouter la colonne si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'providers' 
        AND column_name = 'availability_hours'
    ) THEN
        ALTER TABLE providers 
        ADD COLUMN availability_hours JSONB DEFAULT '{}'::jsonb;
        
        RAISE NOTICE 'Colonne availability_hours ajoutée à la table providers';
    ELSE
        RAISE NOTICE 'La colonne availability_hours existe déjà';
    END IF;
END $$;

-- Ajouter la colonne availability_mode si elle n'existe pas non plus
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'providers' 
        AND column_name = 'availability_mode'
    ) THEN
        ALTER TABLE providers 
        ADD COLUMN availability_mode TEXT DEFAULT 'unavailable'::text;
        
        RAISE NOTICE 'Colonne availability_mode ajoutée à la table providers';
    ELSE
        RAISE NOTICE 'La colonne availability_mode existe déjà';
    END IF;
END $$;

-- Rafraîchir le cache du schéma pour PostgREST
NOTIFY pgrst, 'reload schema';
