-- Migration: Create Credits Table
-- Add credits system for refunds and goodwill credits

-- ============================================
-- CREATE CREDITS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  source_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  reason TEXT CHECK (reason IN ('giver_safety_exit', 'platform_failure', 'goodwill', 'giver_joined_late'))
);

-- Create indexes for efficient queries
CREATE INDEX idx_credits_user_id ON credits(user_id);
CREATE INDEX idx_credits_unused ON credits(user_id) WHERE used_at IS NULL;

-- Add comments
COMMENT ON TABLE credits IS 'User credits for refunds and goodwill';
COMMENT ON COLUMN credits.user_id IS 'User who owns the credit';
COMMENT ON COLUMN credits.amount_cents IS 'Credit amount in cents';
COMMENT ON COLUMN credits.created_at IS 'When credit was issued';
COMMENT ON COLUMN credits.used_at IS 'When credit was used (NULL if unused)';
COMMENT ON COLUMN credits.booking_id IS 'Booking where credit was used';
COMMENT ON COLUMN credits.source_booking_id IS 'Original booking that generated this credit';
COMMENT ON COLUMN credits.reason IS 'Reason credit was issued: giver_safety_exit, platform_failure, goodwill';
