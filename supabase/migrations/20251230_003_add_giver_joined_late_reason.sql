-- Migration: Add 'giver_joined_late' to credits reason constraint
-- This allows credits to be issued when givers join sessions late

-- Drop the existing constraint
ALTER TABLE credits DROP CONSTRAINT IF EXISTS credits_reason_check;

-- Add the updated constraint with the new reason
ALTER TABLE credits ADD CONSTRAINT credits_reason_check
  CHECK (reason IN ('giver_safety_exit', 'platform_failure', 'goodwill', 'giver_joined_late'));

-- Update comment
COMMENT ON COLUMN credits.reason IS 'Reason credit was issued: giver_safety_exit, platform_failure, goodwill, giver_joined_late';
