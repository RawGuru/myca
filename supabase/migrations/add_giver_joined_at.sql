-- Add giver_joined_at timestamp to track when giver joins session
-- Used for lateness detection and automatic seeker credit

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS giver_joined_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.giver_joined_at IS 'Timestamp when giver joined the video session. Used for lateness detection.';
