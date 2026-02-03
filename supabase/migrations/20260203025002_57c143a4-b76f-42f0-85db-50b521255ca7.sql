-- Create storage bucket for child avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('child-avatars', 'child-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload avatars for their children
CREATE POLICY "Parents can upload child avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'child-avatars' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM children WHERE parent_id = auth.uid()
  )
);

-- Allow public read access to avatars
CREATE POLICY "Anyone can view child avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'child-avatars');

-- Allow parents to update/delete their children's avatars
CREATE POLICY "Parents can update child avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'child-avatars' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM children WHERE parent_id = auth.uid()
  )
);

CREATE POLICY "Parents can delete child avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'child-avatars' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM children WHERE parent_id = auth.uid()
  )
);