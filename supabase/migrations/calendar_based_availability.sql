-- Replace weekly recurring availability with calendar-based specific dates
-- Time is anchored to reality - givers pick specific dates, seekers see real dates

-- Drop old availability_schedule column (weekly pattern)
ALTER TABLE givers
DROP COLUMN IF EXISTS availability_schedule;

-- Create new giver_availability table for calendar-based slots
CREATE TABLE IF NOT EXISTS giver_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TIME NOT NULL,
  is_booked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(giver_id, date, time)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_giver_availability_giver ON giver_availability(giver_id);
CREATE INDEX IF NOT EXISTS idx_giver_availability_date ON giver_availability(date);

-- RLS policies
ALTER TABLE giver_availability ENABLE ROW LEVEL SECURITY;

-- Givers can manage their own availability
CREATE POLICY "Givers can view their availability"
  ON giver_availability FOR SELECT
  USING (auth.uid() = giver_id);

CREATE POLICY "Givers can insert their availability"
  ON giver_availability FOR INSERT
  WITH CHECK (auth.uid() = giver_id);

CREATE POLICY "Givers can update their availability"
  ON giver_availability FOR UPDATE
  USING (auth.uid() = giver_id);

CREATE POLICY "Givers can delete their availability"
  ON giver_availability FOR DELETE
  USING (auth.uid() = giver_id);

-- Everyone can view available (unbooked) slots
CREATE POLICY "Anyone can view available slots"
  ON giver_availability FOR SELECT
  USING (is_booked = FALSE);

COMMENT ON TABLE giver_availability IS 'Calendar-based availability. Givers select specific dates/times. No weekly recurrence.';
