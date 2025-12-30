-- Migration: Emergence to Direction System
-- Replace emergence_verb with direction system
-- Add payout/refund tracking to bookings
-- Add direction consent fields to listings

-- ============================================
-- 1. UPDATE LISTINGS TABLE
-- ============================================

-- Add direction and boundary fields
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS directions_allowed TEXT[] DEFAULT ARRAY['go_deeper', 'hear_perspective', 'think_together', 'build_next_step', 'end_cleanly'],
  ADD COLUMN IF NOT EXISTS boundaries TEXT;

-- Add check constraint for valid direction types
ALTER TABLE listings
  ADD CONSTRAINT valid_directions
  CHECK (
    directions_allowed <@ ARRAY['go_deeper', 'hear_perspective', 'think_together', 'build_next_step', 'end_cleanly']::TEXT[]
  );

COMMENT ON COLUMN listings.directions_allowed IS 'Pre-consented direction types giver allows: go_deeper, hear_perspective, think_together, build_next_step, end_cleanly';
COMMENT ON COLUMN listings.boundaries IS 'Giver boundaries and safety guidelines';

-- ============================================
-- 2. UPDATE SESSION_STATES TABLE
-- ============================================

-- Add direction tracking fields
ALTER TABLE session_states
  ADD COLUMN IF NOT EXISTS direction_selected TEXT CHECK (direction_selected IN ('go_deeper', 'hear_perspective', 'think_together', 'build_next_step', 'end_cleanly')),
  ADD COLUMN IF NOT EXISTS direction_source TEXT CHECK (direction_source IN ('pre_consented', 'custom_request')),
  ADD COLUMN IF NOT EXISTS direction_request_text TEXT,
  ADD COLUMN IF NOT EXISTS direction_giver_response TEXT CHECK (direction_giver_response IN ('accepted', 'declined')),
  ADD COLUMN IF NOT EXISTS direction_started_at TIMESTAMPTZ;

-- Update current_phase constraint (replace 'emergence' with 'direction')
ALTER TABLE session_states DROP CONSTRAINT IF EXISTS session_states_current_phase_check;
ALTER TABLE session_states ADD CONSTRAINT session_states_current_phase_check
  CHECK (current_phase IN ('transmission', 'reflection', 'validation', 'direction', 'ended'));

-- Update end_reason constraint with new end reasons
ALTER TABLE session_states DROP CONSTRAINT IF EXISTS session_states_end_reason_check;
ALTER TABLE session_states ADD CONSTRAINT session_states_end_reason_check
  CHECK (end_reason IN (
    'completed',
    'time_expired',
    'participant_left',
    'error',
    'receiver_end_complete',
    'giver_safety_exit',
    'technical_failure',
    'receiver_no_show',
    'giver_no_show'
  ));

-- Keep emergence_verb for backward compatibility (don't drop)
COMMENT ON COLUMN session_states.direction_selected IS 'Direction type selected by receiver';
COMMENT ON COLUMN session_states.direction_source IS 'Whether direction was pre_consented or custom_request';
COMMENT ON COLUMN session_states.direction_request_text IS 'Custom direction text if custom_request (200 char limit)';
COMMENT ON COLUMN session_states.direction_giver_response IS 'Giver response to custom direction request (accepted/declined)';
COMMENT ON COLUMN session_states.direction_started_at IS 'When direction phase started';

-- ============================================
-- 3. UPDATE BOOKINGS TABLE
-- ============================================

-- Add session timing and payout tracking fields
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS end_reason TEXT CHECK (end_reason IN (
    'receiver_end_complete',
    'completed',
    'giver_safety_exit',
    'technical_failure',
    'receiver_no_show',
    'giver_no_show'
  )),
  ADD COLUMN IF NOT EXISTS payout_net_cents INTEGER,
  ADD COLUMN IF NOT EXISTS refund_gross_cents INTEGER,
  ADD COLUMN IF NOT EXISTS payout_status TEXT CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed'));

-- Create index for payout status queries
CREATE INDEX IF NOT EXISTS idx_bookings_payout_status ON bookings(payout_status);
CREATE INDEX IF NOT EXISTS idx_bookings_end_reason ON bookings(end_reason);

COMMENT ON COLUMN bookings.started_at IS 'When session actually started (first participant joined)';
COMMENT ON COLUMN bookings.ended_at IS 'When session ended';
COMMENT ON COLUMN bookings.elapsed_seconds IS 'Total session duration in seconds';
COMMENT ON COLUMN bookings.end_reason IS 'Reason session ended (determines payout policy)';
COMMENT ON COLUMN bookings.payout_net_cents IS 'Net payout to giver after pro-rating';
COMMENT ON COLUMN bookings.refund_gross_cents IS 'Refund amount to receiver';
COMMENT ON COLUMN bookings.payout_status IS 'Status of payout processing';
