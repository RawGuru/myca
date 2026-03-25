-- Add room metadata columns to bookings table for concurrency-safe fresh room creation
-- room_created_at: timestamp when the Daily room was created (for expiry detection)
-- room_generation: optimistic locking counter to prevent race conditions

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_created_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS room_generation INTEGER DEFAULT 0 NOT NULL;

-- Index for efficient room freshness queries
CREATE INDEX IF NOT EXISTS idx_bookings_room_created_at
  ON bookings(room_created_at);

-- Comment the columns for documentation
COMMENT ON COLUMN bookings.room_created_at IS 'Timestamp when the Daily video room was created (used to detect stale/expired rooms)';
COMMENT ON COLUMN bookings.room_generation IS 'Optimistic locking counter incremented each time a new room is created (prevents concurrent race conditions)';
