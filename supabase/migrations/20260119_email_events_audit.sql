-- Email audit trail for verifiable delivery
-- Track all email send attempts with full provider details

CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event text NOT NULL,
  recipient text NOT NULL,
  role text NOT NULL CHECK (role IN ('giver', 'seeker')),
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text,
  http_status int,
  success boolean NOT NULL,
  error_message text,
  payload jsonb
);

-- Index for fast lookups by booking
CREATE INDEX IF NOT EXISTS idx_email_events_booking_id ON email_events(booking_id);

-- Index for recent events (admin view)
CREATE INDEX IF NOT EXISTS idx_email_events_created_at ON email_events(created_at DESC);

-- Index for filtering by success/failure
CREATE INDEX IF NOT EXISTS idx_email_events_success ON email_events(success);

-- RLS policies
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access to email_events"
  ON email_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to view their own booking email events
CREATE POLICY "Users can view email events for their bookings"
  ON email_events
  FOR SELECT
  TO authenticated
  USING (
    booking_id IN (
      SELECT id FROM bookings
      WHERE giver_id = auth.uid() OR seeker_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT SELECT ON email_events TO authenticated;
GRANT ALL ON email_events TO service_role;
