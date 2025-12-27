-- Add accountability tracking counters to giver profiles
-- Tracks session completion and late joins for transparency

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS total_sessions_completed INTEGER DEFAULT 0;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS times_joined_late INTEGER DEFAULT 0;

COMMENT ON COLUMN profiles.total_sessions_completed IS 'Total number of sessions completed by giver';
COMMENT ON COLUMN profiles.times_joined_late IS 'Number of times giver joined more than 2 minutes late';
