-- Add seeker_credit_earned flag for automatic compensation
-- When giver joins > 2 minutes late, seeker automatically gets credit

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS seeker_credit_earned BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN bookings.seeker_credit_earned IS 'Automatic credit earned when giver joins more than 2 minutes late. No requests needed.';
