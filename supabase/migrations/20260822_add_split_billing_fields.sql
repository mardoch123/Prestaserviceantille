-- Migration: Ajout des champs pour la facturation fractionnée par pack
-- Date: 2026-08-22
-- Description: Ajoute les colonnes nécessaires pour supporter la facturation par tranches

-- Ajouter les colonnes pour la facturation fractionnée à la table documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS split_billing_config JSONB;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS split_index INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_splits INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS parent_quote_id UUID REFERENCES documents(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS covered_sessions INTEGER[];
ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_sessions INTEGER;

-- Colonne pour le tracking de lecture des factures fractionnées
ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- Créer un index pour retrouver rapidement les factures fractionnées liées à un devis
CREATE INDEX IF NOT EXISTS idx_documents_parent_quote_id ON documents(parent_quote_id) WHERE parent_quote_id IS NOT NULL;

-- Créer un index pour les devis avec facturation fractionnée configurée
CREATE INDEX IF NOT EXISTS idx_documents_split_billing ON documents(split_billing_config) WHERE split_billing_config IS NOT NULL;

-- Commentaire sur la table pour documentation
COMMENT ON COLUMN documents.split_billing_config IS 'Configuration JSON de la facturation par tranches (totalSessions, sessionsPerSplit, splits, etc.)';
COMMENT ON COLUMN documents.split_index IS 'Index de la tranche pour les factures fractionnées (0-based)';
COMMENT ON COLUMN documents.total_splits IS 'Nombre total de tranches pour ce devis';
COMMENT ON COLUMN documents.parent_quote_id IS 'ID du devis parent pour les factures fractionnées';
COMMENT ON COLUMN documents.covered_sessions IS 'Array des numéros de sessions couvertes par cette tranche';
COMMENT ON COLUMN documents.total_sessions IS 'Nombre total de sessions dans le devis/pack';
COMMENT ON COLUMN documents.is_read IS 'Indique si la facture a été consultée/lue (pour factures fractionnées)';
