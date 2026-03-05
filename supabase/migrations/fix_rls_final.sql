-- Enable RLS for storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Create the bucket if it doesn't exist (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('mission-media', 'mission-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts/duplicates
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated selects" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1ok2230_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1ok2230_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1ok2230_2" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1ok2230_3" ON storage.objects;

-- 3. Create comprehensive policies

-- ALLOW SELECT: Anyone (public) can read files
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'mission-media' );

-- ALLOW INSERT: Authenticated users can upload to mission-media
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'mission-media' );

-- ALLOW UPDATE: Authenticated users can update files in mission-media
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'mission-media' );

-- ALLOW DELETE: Authenticated users can delete files in mission-media
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'mission-media' );
