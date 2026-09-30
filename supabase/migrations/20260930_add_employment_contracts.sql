-- =====================================================================
-- Module Contrats de travail prestataires (CDI salariés)
-- Table employment_contracts : distincte de `contracts` (contrats clients)
-- Exécuter via api/run-migrations.js ou SQL Editor
-- =====================================================================

CREATE TABLE IF NOT EXISTS employment_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Prestataire / salarié (snapshot au moment de la rédaction)
    provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
    employee_first_name VARCHAR(120) NOT NULL,
    employee_last_name VARCHAR(120) NOT NULL,
    employee_email VARCHAR(255),
    employee_address TEXT,
    employee_gender VARCHAR(10) DEFAULT 'f' CHECK (employee_gender IN ('f', 'm')),

    -- Objet du contrat
    contract_type VARCHAR(20) DEFAULT 'cdi' CHECK (contract_type IN ('cdi', 'cdd')),
    start_date DATE NOT NULL,
    job_title TEXT DEFAULT 'Employée à domicile',
    classification VARCHAR(100) DEFAULT 'Employée',
    duties JSONB DEFAULT '[]'::jsonb,                -- ["entretien courant du domicile", ...]
    supervisors JSONB DEFAULT '[]'::jsonb,           -- [{ "name": "...", "role": "..." }]
    work_locations JSONB DEFAULT '[]'::jsonb,        -- ["domicile des clients", ...]

    -- Durée du travail
    weekly_hours NUMERIC(5,2) DEFAULT 0,
    schedule JSONB DEFAULT '[]'::jsonb,              -- [{ "days": [1,3,5], "start": "09:00", "end": "16:00" }]
    monthly_hours NUMERIC(6,2) DEFAULT 0,            -- calculé : weekly_hours * 52 / 12

    -- Rémunération (cohérence : monthly_gross = monthly_hours * hourly_rate)
    hourly_rate NUMERIC(7,2) DEFAULT 0,
    monthly_gross NUMERIC(9,2) DEFAULT 0,
    monthly_net_estimate NUMERIC(9,2),
    payment_period TEXT DEFAULT 'entre le 1er et le 5 du mois',

    -- Clauses
    trial_period_weeks INT,                          -- NULL = pas de période d'essai
    leave_days_per_month NUMERIC(4,2) DEFAULT 2.5,
    collective_agreement TEXT DEFAULT 'Convention collective des entreprises de services à la personne',
    confidentiality BOOLEAN DEFAULT TRUE,
    non_competition BOOLEAN DEFAULT FALSE,
    non_competition_months INT,
    non_competition_compensation_percent NUMERIC(5,2), -- contrepartie financière OBLIGATOIRE si non_competition = TRUE

    -- Cycle de vie
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'terminated')),
    termination_date DATE,
    termination_reason TEXT,

    -- Documents et signature (print/scan hors ligne)
    pdf_path TEXT,                                    -- chemin Storage bucket 'documents'
    signed_scan_path TEXT,                            -- scan du contrat signé (bucket 'documents')
    sent_at TIMESTAMP WITH TIME ZONE,
    signed_at TIMESTAMP WITH TIME ZONE,
    place_of_signature VARCHAR(120) DEFAULT 'Lamentin',
    issued_at DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_employment_contracts_provider_id ON employment_contracts(provider_id);
CREATE INDEX IF NOT EXISTS idx_employment_contracts_status ON employment_contracts(status);
CREATE INDEX IF NOT EXISTS idx_employment_contracts_created_at ON employment_contracts(created_at DESC);

-- Trigger updated_at (réutilise la fonction update_updated_at_column() déjà
-- définie dans les autres migrations ; évite un corps $$ ... $$ qui casse les
-- executeurs SQL découpant le fichier sur les « ; »)
DROP TRIGGER IF EXISTS update_employment_contracts_updated_at ON employment_contracts;
CREATE TRIGGER update_employment_contracts_updated_at
    BEFORE UPDATE ON employment_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- RLS : mêmes conventions que le reste de l'application (contrôle des
-- rôles côté application ; politiques permissives pour ne jamais
-- bloquer refreshData ni le portail prestataire)
-- =====================================================================
ALTER TABLE employment_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employment_contracts_public_read" ON employment_contracts;
DROP POLICY IF EXISTS "employment_contracts_authenticated_write" ON employment_contracts;
DROP POLICY IF EXISTS "employment_contracts_authenticated_update" ON employment_contracts;
DROP POLICY IF EXISTS "employment_contracts_authenticated_delete" ON employment_contracts;

CREATE POLICY "employment_contracts_public_read" ON employment_contracts
    FOR SELECT TO public
    USING (true);

CREATE POLICY "employment_contracts_authenticated_write" ON employment_contracts
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "employment_contracts_authenticated_update" ON employment_contracts
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "employment_contracts_authenticated_delete" ON employment_contracts
    FOR DELETE TO authenticated
    USING (true);

-- Commentaires
COMMENT ON TABLE employment_contracts IS 'Contrats de travail (CDI/CDD) des prestataires salariés';
COMMENT ON COLUMN employment_contracts.monthly_gross IS 'Rémunération mensuelle brute = monthly_hours * hourly_rate (cohérence garantie côté app)';
COMMENT ON COLUMN employment_contracts.non_competition_compensation_percent IS 'Contrepartie financière obligatoire de la clause de non-concurrence (nullité sinon, jurisprudence FR)';
COMMENT ON COLUMN employment_contracts.pdf_path IS 'Chemin du PDF généré dans le bucket documents (contrats-travail/{id}.pdf)';

-- Rechargement du schéma PostgREST
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Storage : autoriser l'écrasement (upsert) et le nettoyage des PDF de
-- contrats de travail dans le bucket public 'documents'
-- =====================================================================
DROP POLICY IF EXISTS "employment_contracts_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "employment_contracts_storage_delete" ON storage.objects;

CREATE POLICY "employment_contracts_storage_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'documents')
    WITH CHECK (bucket_id = 'documents');

CREATE POLICY "employment_contracts_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'documents');
