-- 1. Fix Storage RLS to allow ANONYMOUS uploads (and authenticated)
-- This grants access to EVERYONE (public) to ensure no blocking.

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-media', 'mission-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop all restrictive policies
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;

-- Create PERMISSIVE policies (anon + authenticated)
-- Using "TO public" in PostgreSQL targets everyone (anon + authenticated roles included)

CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'mission-media' );

CREATE POLICY "Allow public uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'mission-media' );

CREATE POLICY "Allow public updates"
ON storage.objects FOR UPDATE
TO public
USING ( bucket_id = 'mission-media' );

CREATE POLICY "Allow public deletes"
ON storage.objects FOR DELETE
TO public
USING ( bucket_id = 'mission-media' );
