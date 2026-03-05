-- 1. Fix Storage RLS (Must be run as superuser/dashboard)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-media', 'mission-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'mission-media' );

CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'mission-media' );

CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'mission-media' );

CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'mission-media' );

-- 2. Create Availability Check Function
CREATE OR REPLACE FUNCTION check_quote_availability(quote_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    doc record;
    slot jsonb;
    slot_date date;
    slot_start time;
    slot_end time;
    
    total_qualified_providers int;
    busy_providers_count int;
    unassigned_conflicting_missions_count int;
    free_providers_count int;
    required_capacity int;
    
    unavailable_slots text[] := ARRAY[]::text[];
BEGIN
    -- Get the document
    SELECT * INTO doc FROM documents WHERE id = quote_id;
    IF NOT FOUND THEN
        RETURN json_build_object('available', false, 'error', 'Document not found');
    END IF;

    -- Iterate over slots
    FOR slot IN SELECT * FROM jsonb_array_elements(doc.slots_data)
    LOOP
        BEGIN
            slot_date := (slot->>'date')::date;
            slot_start := (slot->>'startTime')::time;
            slot_end := (slot->>'endTime')::time;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;

        -- Count total ACTIVE providers (assuming all active providers can potentially do the job)
        -- Ideally we would filter by service_type match if providers had a services column
        SELECT COUNT(*) INTO total_qualified_providers
        FROM providers 
        WHERE status = 'Active';

        -- Count BUSY providers (assigned to a mission overlapping this slot)
        -- Overlap: (StartA < EndB) and (EndA > StartB)
        SELECT COUNT(DISTINCT provider_id) INTO busy_providers_count
        FROM missions m
        WHERE m.status != 'cancelled'
          AND m.date = slot_date
          AND m.start_time < slot_end
          AND m.end_time > slot_start
          AND m.provider_id IS NOT NULL;
          
        -- Count UNASSIGNED conflicting missions (they compete for the same pool)
        SELECT COUNT(*) INTO unassigned_conflicting_missions_count
        FROM missions m
        WHERE m.status != 'cancelled'
          AND m.date = slot_date
          AND m.start_time < slot_end
          AND m.end_time > slot_start
          AND m.provider_id IS NULL;
          
        -- Calculate capacity
        free_providers_count := total_qualified_providers - busy_providers_count;
        -- We need 1 for this quote + N for other unassigned missions
        required_capacity := 1 + unassigned_conflicting_missions_count;
        
        IF free_providers_count < required_capacity THEN
            unavailable_slots := array_append(unavailable_slots, (slot->>'date') || ' ' || (slot->>'startTime') || '-' || (slot->>'endTime'));
        END IF;
        
    END LOOP;

    IF array_length(unavailable_slots, 1) > 0 THEN
        RETURN json_build_object(
            'available', false, 
            'unavailable_slots', unavailable_slots,
            'message', 'Capacité insuffisante pour les créneaux demandés'
        );
    END IF;

    RETURN json_build_object('available', true);
END;
$$;
