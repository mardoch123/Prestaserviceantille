-- Création de la table mission_change_requests et colonnes associées
BEGIN;

CREATE TABLE IF NOT EXISTS mission_change_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    old_date DATE NOT NULL,
    old_start_time TIME NOT NULL,
    old_end_time TIME NOT NULL,
    new_date DATE NOT NULL,
    new_start_time TIME NOT NULL,
    new_end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mission_change_requests_mission_id ON mission_change_requests(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_change_requests_client_id ON mission_change_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_mission_change_requests_status ON mission_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_mission_change_requests_created_at ON mission_change_requests(created_at DESC);

-- Colonnes de suivi côté missions (indicateur pour le planning et la recherche rapide)
ALTER TABLE missions
    ADD COLUMN IF NOT EXISTS pending_reschedule_request_id UUID REFERENCES mission_change_requests(id),
    ADD COLUMN IF NOT EXISTS pending_reschedule_status TEXT NOT NULL DEFAULT 'none' CHECK (pending_reschedule_status IN ('none','pending','approved','rejected'));

-- Trigger pour maintenir pending_reschedule_status automatiquement
CREATE OR REPLACE FUNCTION sync_mission_reschedule_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    latest_request RECORD;
BEGIN
    SELECT * INTO latest_request
    FROM mission_change_requests
    WHERE mission_id = NEW.mission_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF latest_request IS NULL THEN
        UPDATE missions
        SET pending_reschedule_request_id = NULL,
            pending_reschedule_status = 'none'
        WHERE id = NEW.mission_id;
    ELSE
        UPDATE missions
        SET pending_reschedule_request_id = latest_request.id,
            pending_reschedule_status = latest_request.status
        WHERE id = NEW.mission_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mission_reschedule_status ON mission_change_requests;
CREATE TRIGGER trg_sync_mission_reschedule_status
    AFTER INSERT OR UPDATE
    ON mission_change_requests
    FOR EACH ROW
    EXECUTE FUNCTION sync_mission_reschedule_status();

-- RLS
ALTER TABLE mission_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view mission change requests" ON mission_change_requests;
DROP POLICY IF EXISTS "Clients can view their mission change requests" ON mission_change_requests;

CREATE POLICY "Admins can view mission change requests"
    ON mission_change_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

CREATE POLICY "Clients can view their mission change requests"
    ON mission_change_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid()
              AND u.role = 'client'
              AND u.related_entity_id = mission_change_requests.client_id
        )
    );

CREATE POLICY IF NOT EXISTS "System can insert mission change requests"
    ON mission_change_requests FOR INSERT
    WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "System can update mission change requests"
    ON mission_change_requests FOR UPDATE
    USING (true);

COMMIT;
