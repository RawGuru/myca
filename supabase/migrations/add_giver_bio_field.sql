-- Add bio field to giver profiles
-- Allows givers to share background and experience (max 500 characters)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

COMMENT ON COLUMN profiles.bio IS 'Giver bio/background - optional field for sharing experience (max 500 chars)';
