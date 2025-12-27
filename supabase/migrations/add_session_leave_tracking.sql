-- Add session leave tracking to bookings
-- Tracks when giver and seeker leave the video call
-- Enables "who left first" tracking for future refund/credit logic

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS giver_left_at TIMESTAMPTZ;

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS seeker_left_at TIMESTAMPTZ;

COMMENT ON COLUMN bookings.giver_left_at IS 'When giver left the video call (first leave time only)';
COMMENT ON COLUMN bookings.seeker_left_at IS 'When seeker left the video call (first leave time only)';
