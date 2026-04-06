-- Migration: Fix SAV RPC functions and RLS policies
-- Date: 2025-01-08

-- ============================================
-- 1. SUPPRIMER TOUTES LES VERSIONS DES FONCTIONS (CASCADE pour forcer la suppression)
-- ============================================

-- Supprimer TOUTES les versions des fonctions SAV de manière agressive
DO $$
DECLARE
    func RECORD;
BEGIN
    -- Supprimer toutes les versions de create_satisfaction_survey
    FOR func IN SELECT oid::regprocedure::text as funcname 
                FROM pg_proc 
                WHERE proname = 'create_satisfaction_survey'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func.funcname);
    END LOOP;
    
    -- Supprimer toutes les versions des autres fonctions
    FOR func IN SELECT oid::regprocedure::text as funcname 
                FROM pg_proc 
                WHERE proname IN ('get_sav_records', 'get_sav_stats', 'get_sav_mission_ids',
                                  'get_sav_record_by_id', 'create_sav_record', 'update_sav_status',
                                  'get_full_sav_stats', 'get_satisfaction_surveys', 'update_survey_image_url')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', func.funcname);
    END LOOP;
END $$;

-- Fallback: supprimer aussi avec les signatures connues
DROP FUNCTION IF EXISTS create_satisfaction_survey(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_satisfaction_survey() CASCADE;
DROP FUNCTION IF EXISTS get_sav_records() CASCADE;
DROP FUNCTION IF EXISTS get_sav_stats() CASCADE;
DROP FUNCTION IF EXISTS get_sav_mission_ids() CASCADE;

-- ============================================
-- 2. RECREER LES FONCTIONS RPC AVEC SECURITY DEFINER
-- ============================================

-- Fonction pour créer une enquête de satisfaction
CREATE OR REPLACE FUNCTION create_satisfaction_survey(
    p_mission_id UUID,
    p_client_id UUID,
    p_client_name TEXT,
    p_pack_name TEXT,
    p_quality_rating TEXT,
    p_cleanliness_rating TEXT,
    p_recommendation_rating TEXT,
    p_additional_comments TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_investigator_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
    v_user_id UUID;
    v_investigator TEXT;
BEGIN
    -- Définir les valeurs par défaut si non fournies
    v_user_id := COALESCE(p_created_by, auth.uid());
    v_investigator := COALESCE(p_investigator_name, 'Harry');
    
    INSERT INTO satisfaction_surveys (
        mission_id,
        client_id,
        client_name,
        pack_name,
        quality_rating,
        cleanliness_rating,
        recommendation_rating,
        additional_comments,
        created_by,
        investigator_name
    ) VALUES (
        p_mission_id,
        p_client_id,
        p_client_name,
        p_pack_name,
        p_quality_rating,
        p_cleanliness_rating,
        p_recommendation_rating,
        p_additional_comments,
        v_user_id,
        v_investigator
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Fonction pour récupérer tous les enregistrements SAV
CREATE OR REPLACE FUNCTION get_sav_records()
RETURNS SETOF sav_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY SELECT * FROM sav_records ORDER BY created_at DESC;
END;
$$;

-- Fonction pour récupérer un enregistrement SAV par ID
CREATE OR REPLACE FUNCTION get_sav_record_by_id(p_id UUID)
RETURNS sav_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_record sav_records;
BEGIN
    SELECT * INTO v_record FROM sav_records WHERE id = p_id;
    RETURN v_record;
END;
$$;

-- Fonction pour créer un enregistrement SAV
CREATE OR REPLACE FUNCTION create_sav_record(
    p_mission_id UUID,
    p_client_id UUID,
    p_client_name TEXT,
    p_client_address TEXT DEFAULT NULL,
    p_client_phone TEXT DEFAULT NULL,
    p_client_email TEXT DEFAULT NULL,
    p_mission_date DATE DEFAULT NULL,
    p_mission_service TEXT DEFAULT NULL,
    p_pack_name TEXT DEFAULT 'Non spécifié',
    p_provider_name TEXT DEFAULT NULL,
    p_sav_type TEXT DEFAULT 'satisfaction_survey',
    p_description TEXT DEFAULT '',
    p_priority TEXT DEFAULT 'medium',
    p_created_by UUID DEFAULT NULL,
    p_investigator_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO sav_records (
        mission_id,
        client_id,
        client_name,
        client_address,
        client_phone,
        client_email,
        mission_date,
        mission_service,
        pack_name,
        provider_name,
        sav_type,
        description,
        priority,
        status,
        created_by,
        investigator_name
    ) VALUES (
        p_mission_id,
        p_client_id,
        p_client_name,
        p_client_address,
        p_client_phone,
        p_client_email,
        p_mission_date,
        p_mission_service,
        p_pack_name,
        p_provider_name,
        p_sav_type,
        p_description,
        p_priority,
        'pending',
        COALESCE(p_created_by, auth.uid()),
        COALESCE(p_investigator_name, 'Harry')
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Fonction pour mettre à jour le statut d'un SAV
CREATE OR REPLACE FUNCTION update_sav_status(
    p_sav_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE sav_records 
    SET 
        status = p_status,
        completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_sav_id;
    
    RETURN FOUND;
END;
$$;

-- Fonction pour récupérer les statistiques SAV
CREATE OR REPLACE FUNCTION get_sav_stats()
RETURNS TABLE (
    total bigint,
    by_status json,
    by_type json,
    recent_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM sav_records) as total,
        (SELECT COALESCE(json_object_agg(status, cnt), '{}'::json) 
         FROM (SELECT status, COUNT(*) as cnt FROM sav_records GROUP BY status) t) as by_status,
        (SELECT COALESCE(json_object_agg(sav_type, cnt), '{}'::json) 
         FROM (SELECT sav_type, COUNT(*) as cnt FROM sav_records GROUP BY sav_type) t) as by_type,
        (SELECT COUNT(*) FROM sav_records WHERE created_at >= NOW() - INTERVAL '30 days') as recent_count;
END;
$$;

-- Fonction pour récupérer les statistiques complètes SAV (pour client.ts)
CREATE OR REPLACE FUNCTION get_full_sav_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'pending', (SELECT COUNT(*) FROM sav_records WHERE status = 'pending'),
        'in_progress', (SELECT COUNT(*) FROM sav_records WHERE status = 'in_progress'),
        'completed', (SELECT COUNT(*) FROM sav_records WHERE status = 'completed'),
        'by_type', (
            SELECT json_build_object(
                'satisfaction_survey', (SELECT COUNT(*) FROM satisfaction_surveys), -- Count from correct table
                'complaint', (SELECT COUNT(*) FROM sav_records WHERE sav_type = 'complaint'),
                'incident', (SELECT COUNT(*) FROM sav_records WHERE sav_type = 'incident'),
                'follow_up', (SELECT COUNT(*) FROM sav_records WHERE sav_type = 'follow_up')
            )
        ),
        'surveys', (
            SELECT COALESCE(json_agg(s.*), '[]'::json)
            FROM satisfaction_surveys s
        )
    ) INTO v_result;
    
    RETURN v_result;
END;
$$;

-- Fonction pour récupérer les enquêtes de satisfaction
CREATE OR REPLACE FUNCTION get_satisfaction_surveys(p_mission_id UUID DEFAULT NULL)
RETURNS SETOF satisfaction_surveys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_mission_id IS NOT NULL THEN
        RETURN QUERY SELECT * FROM satisfaction_surveys WHERE mission_id = p_mission_id ORDER BY created_at DESC;
    ELSE
        RETURN QUERY SELECT * FROM satisfaction_surveys ORDER BY created_at DESC;
    END IF;
END;
$$;

-- Fonction pour récupérer les mission_id des SAV ET des enquêtes de satisfaction
CREATE OR REPLACE FUNCTION get_sav_mission_ids()
RETURNS TABLE (mission_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Combine mission IDs from both sav_records and satisfaction_surveys
    RETURN QUERY 
    SELECT DISTINCT s.mission_id FROM sav_records s WHERE s.mission_id IS NOT NULL
    UNION
    SELECT DISTINCT ss.mission_id FROM satisfaction_surveys ss WHERE ss.mission_id IS NOT NULL;
END;
$$;

-- Fonction pour mettre à jour l'URL d'image d'une enquête
CREATE OR REPLACE FUNCTION update_survey_image_url(
    p_survey_id UUID,
    p_image_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE satisfaction_surveys 
    SET 
        form_image_url = p_image_url,
        updated_at = NOW()
    WHERE id = p_survey_id;
    
    RETURN FOUND;
END;
$$;

-- Fonction pour récupérer une enquête par ID
CREATE OR REPLACE FUNCTION get_satisfaction_survey_by_id(p_id UUID)
RETURNS satisfaction_surveys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_survey satisfaction_surveys;
BEGIN
    SELECT * INTO v_survey FROM satisfaction_surveys WHERE id = p_id;
    RETURN v_survey;
END;
$$;

-- ============================================
-- 3. ACCORDER LES PERMISSIONS D'EXECUTION
-- ============================================

GRANT EXECUTE ON FUNCTION create_satisfaction_survey TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sav_records TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sav_record_by_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_sav_record TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_sav_status TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sav_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_full_sav_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_satisfaction_surveys TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_satisfaction_survey_by_id TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sav_mission_ids TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_survey_image_url TO anon, authenticated;

-- ============================================
-- 4. FIX RLS POLICIES - AJOUTER POLICIES POUR ANON
-- ============================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS sav_records_all_authenticated ON sav_records;
DROP POLICY IF EXISTS satisfaction_surveys_all_authenticated ON satisfaction_surveys;
DROP POLICY IF EXISTS sav_actions_all_authenticated ON sav_actions;
DROP POLICY IF EXISTS sav_records_all_anon ON sav_records;
DROP POLICY IF EXISTS satisfaction_surveys_all_anon ON satisfaction_surveys;
DROP POLICY IF EXISTS sav_actions_all_anon ON sav_actions;

-- Politique pour sav_records (permettre tout à authenticated et anon via RPC)
CREATE POLICY sav_records_all_authenticated ON sav_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY sav_records_all_anon ON sav_records
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Politique pour satisfaction_surveys
CREATE POLICY satisfaction_surveys_all_authenticated ON satisfaction_surveys
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY satisfaction_surveys_all_anon ON satisfaction_surveys
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Politique pour sav_actions
CREATE POLICY sav_actions_all_authenticated ON sav_actions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY sav_actions_all_anon ON sav_actions
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- Politique pour missions (nécessaire pour les requêtes directes)
DROP POLICY IF EXISTS missions_all_authenticated ON missions;
DROP POLICY IF EXISTS missions_all_anon ON missions;

CREATE POLICY missions_all_authenticated ON missions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY missions_all_anon ON missions
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
