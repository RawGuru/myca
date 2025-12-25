-- Add video_room_url column to bookings table if it doesn't exist
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS video_room_url TEXT;

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_video_room_url ON bookings(video_room_url);

-- Add a comment to document the column
COMMENT ON COLUMN bookings.video_room_url IS 'Daily.co video room URL for the session, expires 35 minutes after creation';
