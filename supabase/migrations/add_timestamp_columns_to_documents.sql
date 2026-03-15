-- =============================================================================
-- AJOUT DES COLONNES MANQUANTES À LA TABLE DOCUMENTS
-- =============================================================================
-- Ce script ajoute created_at et updated_at à la table documents
-- pour éviter les erreurs lors des INSERT/UPDATE
-- =============================================================================

-- Ajouter created_at si manquant
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Ajouter updated_at si manquant  
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Mettre à jour les valeurs pour les lignes existantes (optionnel mais propre)
UPDATE documents 
SET created_at = COALESCE(date::timestamp, CURRENT_TIMESTAMP),
    updated_at = COALESCE(date::timestamp, CURRENT_TIMESTAMP)
WHERE created_at IS NULL;

-- Créer le trigger pour mettre à jour updated_at automatiquement (si pas déjà présent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Supprimer le trigger s'il existe déjà pour éviter les doublons
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;

-- Créer le trigger
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Vérification
SELECT 
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'documents' 
  AND column_name IN ('created_at', 'updated_at')
ORDER BY column_name;
