-- Add profile picture support
-- This adds profile_picture_url field to profiles table

-- Add profile_picture_url column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add comment
COMMENT ON COLUMN profiles.profile_picture_url IS 'URL to profile picture stored in Supabase Storage (profile-pictures bucket)';

-- Note: Create 'profile-pictures' bucket in Supabase Storage with:
-- - Public access for reading
-- - Authenticated users can upload
-- - Max file size: 5MB
-- - Allowed file types: image/*
