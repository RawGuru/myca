-- Session Protocol Tables
-- Implements phased session protocol: transmission → reflection → validation → emergence
-- Tracks session state, milestones, and giver quality metrics

-- ============================================
-- 1. SESSION_STATES TABLE
-- ============================================
-- Tracks current phase and state for each session

CREATE TABLE IF NOT EXISTS session_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,

  -- Phase tracking
  current_phase TEXT NOT NULL DEFAULT 'transmission' CHECK (current_phase IN ('transmission', 'reflection', 'validation', 'emergence', 'ended')),

  -- Validation tracking (unlimited retries, time pressure is the natural limit)
  validation_attempts INTEGER DEFAULT 0,

  -- Emergence tracking
  emergence_verb TEXT CHECK (emergence_verb IN ('explore', 'strategize', 'reflect_deeper', 'challenge', 'synthesize', 'just_talk')),

  -- Extension tracking (for receiver-initiated extension flow)
  extension_pending BOOLEAN DEFAULT FALSE,
  extension_id UUID REFERENCES extensions(id),

  -- Phase timestamps (for analytics and time tracking)
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transmission_started_at TIMESTAMPTZ,
  reflection_started_at TIMESTAMPTZ,
  validation_started_at TIMESTAMPTZ,
  emergence_started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Session end metadata
  end_reason TEXT CHECK (end_reason IN ('completed', 'time_expired', 'participant_left', 'error')),

  -- Update tracking
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_states_booking ON session_states(booking_id);
CREATE INDEX IF NOT EXISTS idx_session_states_phase ON session_states(current_phase);

-- Comments
COMMENT ON TABLE session_states IS 'Tracks session phase state for phased protocol';
COMMENT ON COLUMN session_states.current_phase IS 'Current phase: transmission (receiver speaks) → reflection (giver reflects) → validation (receiver validates) → emergence (both speak)';
COMMENT ON COLUMN session_states.validation_attempts IS 'Number of times receiver said "No, something is missing" (unlimited retries)';
COMMENT ON COLUMN session_states.emergence_verb IS 'Verb selected by receiver upon entering emergence phase';

-- RLS Policies
ALTER TABLE session_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking participants can view session state"
  ON session_states FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = session_states.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

CREATE POLICY "Booking participants can update session state"
  ON session_states FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = session_states.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

CREATE POLICY "Booking participants can insert session state"
  ON session_states FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = session_states.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

-- ============================================
-- 2. SESSION_MILESTONES TABLE
-- ============================================
-- Event log for session analytics and quality metrics

CREATE TABLE IF NOT EXISTS session_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Event type - comprehensive list for analytics
  event_type TEXT NOT NULL CHECK (event_type IN (
    'phase_transition',
    'validation_failed',
    'validation_succeeded',
    'auto_advance_transmission',
    'auto_advance_reflection',
    'extension_requested',
    'extension_granted',
    'extension_declined',
    'participant_disconnected',
    'participant_reconnected',
    'session_ended',
    'mic_permission_denied'
  )),

  -- Who triggered this event (nullable for system events)
  user_id UUID REFERENCES auth.users(id),

  -- Flexible metadata field for event-specific data
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_milestones_booking ON session_milestones(booking_id);
CREATE INDEX IF NOT EXISTS idx_session_milestones_event_type ON session_milestones(event_type);
CREATE INDEX IF NOT EXISTS idx_session_milestones_created_at ON session_milestones(created_at);

-- Comments
COMMENT ON TABLE session_milestones IS 'Event log for session analytics - tracks all significant events during session';
COMMENT ON COLUMN session_milestones.metadata IS 'Flexible JSONB field for event-specific data (e.g., {validation_attempts: 3, reason: "time_expired"})';

-- RLS Policies
ALTER TABLE session_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking participants can view milestones"
  ON session_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = session_milestones.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

CREATE POLICY "System can insert milestones"
  ON session_milestones FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 3. GIVER_METRICS TABLE
-- ============================================
-- Quality metrics for givers (INVISIBLE to users, used for discovery ranking)

CREATE TABLE IF NOT EXISTS giver_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Session quality metrics (from feedback table)
  total_sessions_completed INTEGER DEFAULT 0,
  would_book_again_count INTEGER DEFAULT 0,
  matched_mode_count INTEGER DEFAULT 0,

  -- Computed quality score (0.00 to 1.00)
  -- Formula: (would_book_again * 0.6 + matched_mode * 0.4) / total_sessions
  quality_score DECIMAL(3,2) GENERATED ALWAYS AS (
    CASE WHEN total_sessions_completed > 0
    THEN (
      (would_book_again_count::DECIMAL * 0.6) +
      (matched_mode_count::DECIMAL * 0.4)
    ) / total_sessions_completed
    ELSE 0 END
  ) STORED,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE giver_metrics IS 'Quality metrics for givers - INVISIBLE to users, used only for discovery ranking';
COMMENT ON COLUMN giver_metrics.quality_score IS 'Weighted quality score: 60% would_book_again + 40% matched_mode (0.00 to 1.00)';

-- RLS: Completely private (not even visible to giver)
ALTER TABLE giver_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only system can access giver metrics"
  ON giver_metrics FOR ALL
  USING (false); -- No one can read via client, only via backend functions

-- ============================================
-- 4. TRIGGER FUNCTION
-- ============================================
-- Auto-update giver_metrics when feedback is submitted

CREATE OR REPLACE FUNCTION update_giver_quality_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update giver metrics based on new feedback
  INSERT INTO giver_metrics (
    giver_id,
    total_sessions_completed,
    would_book_again_count,
    matched_mode_count
  )
  VALUES (
    NEW.giver_id,
    1,
    CASE WHEN NEW.would_book_again THEN 1 ELSE 0 END,
    CASE WHEN NEW.matched_mode THEN 1 ELSE 0 END
  )
  ON CONFLICT (giver_id) DO UPDATE SET
    total_sessions_completed = giver_metrics.total_sessions_completed + 1,
    would_book_again_count = giver_metrics.would_book_again_count + CASE WHEN NEW.would_book_again THEN 1 ELSE 0 END,
    matched_mode_count = giver_metrics.matched_mode_count + CASE WHEN NEW.matched_mode THEN 1 ELSE 0 END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_giver_quality_metrics() IS 'Trigger function to update giver_metrics when feedback is submitted';

-- Create trigger on feedback table
DROP TRIGGER IF EXISTS update_metrics_on_feedback ON feedback;
CREATE TRIGGER update_metrics_on_feedback
  AFTER INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_giver_quality_metrics();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables: session_states, session_milestones, giver_metrics
-- Trigger: update_metrics_on_feedback
-- RLS policies: All tables protected
