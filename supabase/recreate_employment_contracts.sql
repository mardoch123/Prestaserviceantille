-- =====================================================================
-- REINITIALISATION COMPLETE de employment_contracts (drop + recréation
-- propre + GRANT + RLS), calquée sur les autres tables de l'app.
--
-- !!! A EXECUTER SUR LE POSTGRES DU VPS (la base réellement utilisée par
-- l'app https://outremerfermetures.com/api), PAS dans le dashboard cloud.
--
-- Ligne 1 du script affiche current_database() : vérifiez que c'est bien
-- la base du VPS (sinon vous êtes au mauvais endroit -> d'où le
-- « permission denied » persistant malgré un contrôle qui dit « ok »).
--
-- Via SSH (recommandé, garantit la bonne base) :
--   ssh root@outremerfermetures.com
--   docker ps | grep supabase_db            # noter le nom du conteneur
--   docker exec -i <nom_conteneur> psql -U postgres -d postgres < recreate_employment_contracts.sql
-- =====================================================================

SELECT current_database() AS "VERIFIEZ_BASE_CI_DESSOUS", version() AS "version";

-- 1. Drop propre (CASCADE retire triggers + politiques avec la table)
DROP TABLE IF EXISTS public.employment_contracts CASCADE;

-- 2. Recréation (schéma identique à la migration d'origine)
CREATE TABLE public.employment_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
    employee_first_name VARCHAR(120) NOT NULL,
    employee_last_name VARCHAR(120) NOT NULL,
    employee_email VARCHAR(255),
    employee_address TEXT,
    employee_gender VARCHAR(10) DEFAULT 'f' CHECK (employee_gender IN ('f', 'm')),

    contract_type VARCHAR(20) DEFAULT 'cdi' CHECK (contract_type IN ('cdi', 'cdd')),
    start_date DATE NOT NULL,
    job_title TEXT DEFAULT 'Employée à domicile',
    classification VARCHAR(100) DEFAULT 'Employée',
    duties JSONB DEFAULT '[]'::jsonb,
    supervisors JSONB DEFAULT '[]'::jsonb,
    work_locations JSONB DEFAULT '[]'::jsonb,

    weekly_hours NUMERIC(5,2) DEFAULT 0,
    schedule JSONB DEFAULT '[]'::jsonb,
    monthly_hours NUMERIC(6,2) DEFAULT 0,

    hourly_rate NUMERIC(7,2) DEFAULT 0,
    monthly_gross NUMERIC(9,2) DEFAULT 0,
    monthly_net_estimate NUMERIC(9,2),
    payment_period TEXT DEFAULT 'entre le 1er et le 5 du mois',

    trial_period_weeks INT,
    leave_days_per_month NUMERIC(4,2) DEFAULT 2.5,
    collective_agreement TEXT DEFAULT 'Convention collective des entreprises de services à la personne',
    confidentiality BOOLEAN DEFAULT TRUE,
    non_competition BOOLEAN DEFAULT FALSE,
    non_competition_months INT,
    non_competition_compensation_percent NUMERIC(5,2),

    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'terminated')),
    termination_date DATE,
    termination_reason TEXT,

    pdf_path TEXT,
    signed_scan_path TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    signed_at TIMESTAMP WITH TIME ZONE,
    place_of_signature VARCHAR(120) DEFAULT 'Lamentin',
    issued_at DATE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Index
CREATE INDEX idx_employment_contracts_provider_id ON public.employment_contracts(provider_id);
CREATE INDEX idx_employment_contracts_status ON public.employment_contracts(status);
CREATE INDEX idx_employment_contracts_created_at ON public.employment_contracts(created_at DESC);

-- 4. Trigger updated_at (fonction déjà présente ailleurs sur le serveur)
CREATE TRIGGER update_employment_contracts_updated_at
    BEFORE UPDATE ON public.employment_contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS (mêmes conventions permissives que le reste de l'app)
ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employment_contracts_public_read" ON public.employment_contracts
    FOR SELECT TO public USING (true);
CREATE POLICY "employment_contracts_authenticated_write" ON public.employment_contracts
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "employment_contracts_authenticated_update" ON public.employment_contracts
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "employment_contracts_authenticated_delete" ON public.employment_contracts
    FOR DELETE TO authenticated USING (true);

-- 6. GRANTs (INDISPENSABLES en plus du RLS ; c'est ce qui manquait)
GRANT SELECT ON public.employment_contracts TO anon, authenticated, service_role;
GRANT INSERT ON public.employment_contracts TO authenticated, service_role;
GRANT UPDATE ON public.employment_contracts TO authenticated, service_role;
GRANT DELETE ON public.employment_contracts TO authenticated, service_role;

-- 7. Rechargement du schéma PostgREST
NOTIFY pgrst, 'reload schema';

-- 8. Contrôle final : authenticated doit avoir INSERT/UPDATE/DELETE/SELECT
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'employment_contracts'
ORDER BY grantee, privilege_type;
