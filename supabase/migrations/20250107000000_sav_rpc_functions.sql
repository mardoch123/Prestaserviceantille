-- Migration: Créer des fonctions RPC pour contourner RLS
-- Ces fonctions s'exécutent avec les privilèges du propriétaire (SECURITY DEFINER)

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
BEGIN
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
        COALESCE(p_created_by, auth.uid()),
        COALESCE(p_investigator_name, 'Harry')
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
        (SELECT json_object_agg(status, cnt) FROM (SELECT status, COUNT(*) as cnt FROM sav_records GROUP BY status) t) as by_status,
        (SELECT json_object_agg(sav_type, cnt) FROM (SELECT sav_type, COUNT(*) as cnt FROM sav_records GROUP BY sav_type) t) as by_type,
        (SELECT COUNT(*) FROM sav_records WHERE created_at >= NOW() - INTERVAL '30 days') as recent_count;
END;
$$;

-- Fonction pour récupérer les mission_id des SAV
CREATE OR REPLACE FUNCTION get_sav_mission_ids()
RETURNS TABLE (mission_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY SELECT DISTINCT s.mission_id FROM sav_records s WHERE s.mission_id IS NOT NULL;
END;
$$;

-- Accorder les permissions d'exécution aux utilisateurs authentifiés et anonymes
GRANT EXECUTE ON FUNCTION create_satisfaction_survey TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sav_records TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sav_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_sav_mission_ids TO anon, authenticated;
