-- Script pour ajouter les nouveaux champs à la table contracts
-- Exécuter ce script dans Supabase SQL Editor

-- Vérifier si la table contracts existe, sinon la créer
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    pack_id UUID REFERENCES packs(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'pending_validation')),
    is_sap BOOLEAN DEFAULT FALSE,
    validation_date TIMESTAMP WITH TIME ZONE,
    admin_signature_url TEXT,
    client_signature_url TEXT,
    company_stamp_url TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    signed_at TIMESTAMP WITH TIME ZONE,
    validation_status VARCHAR(50) DEFAULT 'draft' CHECK (validation_status IN ('draft', 'pending_validation', 'validated', 'rejected')),
    validated_by UUID REFERENCES users(id),
    validation_requested_at TIMESTAMP WITH TIME ZONE,
    validation_requested_by UUID REFERENCES users(id),
    is_modifiable BOOLEAN DEFAULT TRUE,
    is_generic BOOLEAN DEFAULT FALSE,
    quote_id UUID REFERENCES documents(id),
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ajouter les nouveaux champs pour le PDF ContractPDF s'ils n'existent pas déjà
DO $$
BEGIN
    -- Ajouter created_at si'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contracts' AND column_name = 'created_at') THEN
        ALTER TABLE contracts ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;

    -- Ajouter duration si'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contracts' AND column_name = 'duration') THEN
        ALTER TABLE contracts ADD COLUMN duration TEXT;
    END IF;

    -- Ajouter amount si'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contracts' AND column_name = 'amount') THEN
        ALTER TABLE contracts ADD COLUMN amount DECIMAL(10,2);
    END IF;

    -- Ajouter payment_terms si'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contracts' AND column_name = 'payment_terms') THEN
        ALTER TABLE contracts ADD COLUMN payment_terms TEXT;
    END IF;

    -- Ajouter object si'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contracts' AND column_name = 'object') THEN
        ALTER TABLE contracts ADD COLUMN object TEXT;
    END IF;

    -- Ajouter services si'il n'existe pas (JSONB pour stocker un tableau d'objets)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contracts' AND column_name = 'services') THEN
        ALTER TABLE contracts ADD COLUMN services JSONB;
    END IF;

    -- Ajouter client_signature comme alias si'il n'existe pas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'contracts' AND column_name = 'client_signature') THEN
        ALTER TABLE contracts ADD COLUMN client_signature TEXT;
    END IF;
END $$;

-- Créer des index pour les nouveaux champs
CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_pack_id ON contracts(pack_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts(created_at DESC);

-- Trigger pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_contracts_updated_at_trigger ON contracts;
CREATE TRIGGER update_contracts_updated_at_trigger 
    BEFORE UPDATE ON contracts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_contracts_updated_at();

-- Activer RLS (Row Level Security)
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité
CREATE POLICY "Admins can view all contracts" ON contracts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            JOIN user_profiles ON auth.users.id = user_profiles.user_id 
            WHERE user_profiles.role IN ('admin', 'super_admin') AND auth.users.id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert contracts" ON contracts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users 
            JOIN user_profiles ON auth.users.id = user_profiles.user_id 
            WHERE user_profiles.role IN ('admin', 'super_admin') AND auth.users.id = auth.uid()
        )
    );

CREATE POLICY "Admins can update contracts" ON contracts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            JOIN user_profiles ON auth.users.id = user_profiles.user_id 
            WHERE user_profiles.role IN ('admin', 'super_admin') AND auth.users.id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete contracts" ON contracts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            JOIN user_profiles ON auth.users.id = user_profiles.user_id 
            WHERE user_profiles.role IN ('admin', 'super_admin') AND auth.users.id = auth.uid()
        )
    );

-- Commentaires pour la documentation
COMMENT ON TABLE contracts IS 'Table des contrats de services';
COMMENT ON COLUMN contracts.created_at IS 'Date de création du contrat (heure de Martinique)';
COMMENT ON COLUMN contracts.duration IS 'Durée du contrat';
COMMENT ON COLUMN contracts.amount IS 'Montant du contrat';
COMMENT ON COLUMN contracts.payment_terms IS 'Conditions de paiement';
COMMENT ON COLUMN contracts.object IS 'Objet du contrat';
COMMENT ON COLUMN contracts.services IS 'Services inclus (JSONB)';
COMMENT ON COLUMN contracts.client_signature IS 'Signature du client (alias pour client_signature_url)';
