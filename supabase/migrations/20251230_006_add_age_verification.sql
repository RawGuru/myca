-- Migration: Add age verification timestamp to profiles
-- Users must confirm they are 18+ before creating an account

-- Add age_verified_at column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN profiles.age_verified_at IS 'Timestamp when user confirmed they are 18 years of age or older';
