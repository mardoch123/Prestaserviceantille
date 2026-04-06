-- Création des tables pour le module SAV (Service Après-Vente)
-- À exécuter dans Supabase

-- Table des enregistrements SAV
CREATE TABLE IF NOT EXISTS sav_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_address TEXT,
    client_phone TEXT,
    client_email TEXT,
    mission_date DATE NOT NULL,
    mission_service TEXT NOT NULL,
    pack_name TEXT NOT NULL DEFAULT 'Non spécifié',
    provider_name TEXT,
    sav_type TEXT NOT NULL CHECK (sav_type IN ('satisfaction_survey', 'complaint', 'incident', 'follow_up')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    investigator_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_sav_records_mission_id ON sav_records(mission_id);
CREATE INDEX IF NOT EXISTS idx_sav_records_client_id ON sav_records(client_id);
CREATE INDEX IF NOT EXISTS idx_sav_records_status ON sav_records(status);
CREATE INDEX IF NOT EXISTS idx_sav_records_sav_type ON sav_records(sav_type);
CREATE INDEX IF NOT EXISTS idx_sav_records_created_at ON sav_records(created_at);

-- Table des enquêtes de satisfaction
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    pack_name TEXT NOT NULL DEFAULT 'Non spécifié',
    quality_rating TEXT NOT NULL CHECK (quality_rating IN ('excellent', 'bon', 'a_améliorer')),
    cleanliness_rating TEXT NOT NULL CHECK (cleanliness_rating IN ('très_propre', 'correctement_propre', 'à_améliorer')),
    recommendation_rating TEXT NOT NULL CHECK (recommendation_rating IN ('oui', 'peut_être', 'non')),
    additional_comments TEXT,
    form_image_url TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    investigator_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les enquêtes
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_mission_id ON satisfaction_surveys(mission_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_client_id ON satisfaction_surveys(client_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_created_at ON satisfaction_surveys(created_at);

-- Table des actions SAV
CREATE TABLE IF NOT EXISTS sav_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sav_id UUID NOT NULL REFERENCES sav_records(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Index pour les actions
CREATE INDEX IF NOT EXISTS idx_sav_actions_sav_id ON sav_actions(sav_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
DROP TRIGGER IF EXISTS update_sav_records_updated_at ON sav_records;
CREATE TRIGGER update_sav_records_updated_at
    BEFORE UPDATE ON sav_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_satisfaction_surveys_updated_at ON satisfaction_surveys;
CREATE TRIGGER update_satisfaction_surveys_updated_at
    BEFORE UPDATE ON satisfaction_surveys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Politiques RLS (Row Level Security) pour la sécurité
ALTER TABLE sav_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sav_actions ENABLE ROW LEVEL SECURITY;

-- Politique: tous les utilisateurs authentifiés peuvent tout faire
CREATE POLICY sav_records_all_authenticated ON sav_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY satisfaction_surveys_all_authenticated ON satisfaction_surveys
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY sav_actions_all_authenticated ON sav_actions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS sav_records_admin_all ON sav_records;
DROP POLICY IF EXISTS satisfaction_surveys_admin_all ON satisfaction_surveys;
DROP POLICY IF EXISTS sav_actions_admin_all ON sav_actions;

-- Vue pour compter les missions terminées sans SAV
CREATE OR REPLACE VIEW missions_without_sav AS
SELECT 
    m.id, 
    m.date, 
    m.start_time, 
    m.end_time, 
    m.duration,
    m.client_id,
    m.provider_id, 
    m.provider_name, 
    m.service, 
    m.status, 
    m.color, 
    m.source,
    m.created_at, 
    m.updated_at,
    c.name as client_name, 
    c.address as client_address, 
    c.phone as client_phone, 
    c.email as client_email
FROM missions m
LEFT JOIN sav_records s ON m.id = s.mission_id
LEFT JOIN clients c ON m.client_id = c.id
WHERE m.status = 'completed'
AND s.id IS NULL;

-- Vue pour les statistiques SAV
CREATE OR REPLACE VIEW sav_stats AS
SELECT
    (SELECT COUNT(*) FROM sav_records WHERE status = 'pending') as pending_count,
    (SELECT COUNT(*) FROM sav_records WHERE status = 'in_progress') as in_progress_count,
    (SELECT COUNT(*) FROM sav_records WHERE status = 'completed') as completed_count,
    (SELECT COUNT(*) FROM sav_records WHERE sav_type = 'satisfaction_survey') as satisfaction_survey_count,
    (SELECT COUNT(*) FROM sav_records WHERE sav_type = 'complaint') as complaint_count,
    (SELECT COUNT(*) FROM sav_records WHERE sav_type = 'incident') as incident_count,
    (SELECT COUNT(*) FROM sav_records WHERE sav_type = 'follow_up') as follow_up_count;
