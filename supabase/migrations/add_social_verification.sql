-- Add social media verification fields to profiles table
-- Enables trust building without requiring government ID

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter_handle TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_handle TEXT;

COMMENT ON COLUMN profiles.twitter_handle IS 'Twitter/X handle for social verification';
COMMENT ON COLUMN profiles.instagram_handle IS 'Instagram handle for social verification';
COMMENT ON COLUMN profiles.linkedin_handle IS 'LinkedIn profile URL or handle for social verification';
