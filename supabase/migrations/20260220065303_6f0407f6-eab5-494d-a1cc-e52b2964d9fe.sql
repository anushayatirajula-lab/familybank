
-- Make child-avatars bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'child-avatars';

-- Remove the public read-all policy
DROP POLICY IF EXISTS "Anyone can view child avatars" ON storage.objects;

-- Add authenticated-only read policy scoped to parent or child
CREATE POLICY "Authenticated users can view child avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'child-avatars' AND
  (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.children 
    WHERE parent_id = auth.uid() OR user_id = auth.uid()
  )
);
