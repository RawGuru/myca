-- Update extensions table for receiver-initiated flow
-- Remove double-blind voting fields, add receiver-initiated flow fields

-- Add new columns for receiver-initiated extension flow
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES auth.users(id);
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ;
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS giver_response TEXT CHECK (giver_response IN ('accepted', 'declined', 'timeout'));
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS giver_responded_at TIMESTAMPTZ;
ALTER TABLE extensions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'timeout', 'payment_failed'));

-- Drop old double-blind columns (if they exist)
ALTER TABLE extensions DROP COLUMN IF EXISTS giver_confirmed;
ALTER TABLE extensions DROP COLUMN IF EXISTS seeker_confirmed;

-- Add comments
COMMENT ON COLUMN extensions.requested_by IS 'User ID of the receiver who requested the extension';
COMMENT ON COLUMN extensions.requested_at IS 'When the extension was requested';
COMMENT ON COLUMN extensions.giver_response IS 'Giver response: accepted, declined, or timeout (30s)';
COMMENT ON COLUMN extensions.giver_responded_at IS 'When the giver responded';
COMMENT ON COLUMN extensions.status IS 'Extension status: pending, accepted, declined, timeout, or payment_failed';

-- Update RLS policies if needed
-- (existing policies should still work, but we can add more specific ones)

CREATE POLICY "Participants can view their extensions"
  ON extensions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = extensions.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

CREATE POLICY "Participants can create extensions"
  ON extensions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = extensions.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

CREATE POLICY "Participants can update their extensions"
  ON extensions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = extensions.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );
