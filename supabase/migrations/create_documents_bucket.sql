-- Create documents bucket for SAV survey images and other documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to documents bucket
CREATE POLICY "Allow authenticated uploads to documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow authenticated users to read from documents bucket
CREATE POLICY "Allow authenticated read from documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow anon users to read from documents bucket (for public survey images)
CREATE POLICY "Allow public read from documents"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'documents');
