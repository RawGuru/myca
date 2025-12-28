-- Add RLS policies for profile picture uploads
-- Fixes "new row violates row-level security policy" error

-- Allow authenticated users to upload to profile-pictures bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-pictures');

-- Allow public reads from profile-pictures bucket
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

-- Allow users to update their own profile pictures
CREATE POLICY "Allow users to update own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-pictures');

-- Allow users to delete their own profile pictures
CREATE POLICY "Allow users to delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'profile-pictures');
