-- Migration: Create listing-videos storage bucket with RLS policies
-- Allows authenticated users to upload and view listing videos

-- Create the listing-videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-videos',
  'listing-videos',
  true,  -- Public bucket so videos can be viewed
  52428800,  -- 50MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Allow authenticated users to upload videos
CREATE POLICY "Authenticated users can upload listing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-videos');

-- RLS Policy: Allow authenticated users to update their own videos
CREATE POLICY "Users can update their own listing videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-videos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'listing-videos' AND owner = auth.uid());

-- RLS Policy: Allow authenticated users to delete their own videos
CREATE POLICY "Users can delete their own listing videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-videos' AND owner = auth.uid());

-- RLS Policy: Allow everyone to view videos (public bucket)
CREATE POLICY "Anyone can view listing videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'listing-videos');

-- Add comment
COMMENT ON BUCKET listing_videos IS 'Storage for giver listing preview videos (max 50MB)';
