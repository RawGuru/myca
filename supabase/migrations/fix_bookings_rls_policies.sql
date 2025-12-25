-- Fix RLS policies for bookings table to allow video_room_url updates
-- This ensures users can update their own bookings during payment confirmation

-- First, let's see what we're working with (comment out to run in production)
-- SELECT * FROM pg_policies WHERE tablename = 'bookings';

-- Drop existing policies (if they exist) to recreate them properly
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can insert their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Seekers can view their bookings" ON bookings;
DROP POLICY IF EXISTS "Givers can view their bookings" ON bookings;
DROP POLICY IF EXISTS "Seekers can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Seekers can update their bookings" ON bookings;
DROP POLICY IF EXISTS "Givers can update their bookings" ON bookings;

-- Enable RLS on bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy 1: Seekers can view bookings where they are the seeker
CREATE POLICY "Seekers can view their bookings"
  ON bookings
  FOR SELECT
  USING (auth.uid() = seeker_id);

-- Policy 2: Givers can view bookings where they are the giver
CREATE POLICY "Givers can view their bookings"
  ON bookings
  FOR SELECT
  USING (auth.uid() = giver_id);

-- Policy 3: Seekers can create bookings
CREATE POLICY "Seekers can insert bookings"
  ON bookings
  FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);

-- Policy 4: Seekers can update their own bookings
-- This is critical for payment confirmation and video_room_url updates
CREATE POLICY "Seekers can update their bookings"
  ON bookings
  FOR UPDATE
  USING (auth.uid() = seeker_id)
  WITH CHECK (auth.uid() = seeker_id);

-- Policy 5: Givers can update bookings where they are the giver
-- This allows givers to update status (e.g., mark as completed)
CREATE POLICY "Givers can update their bookings"
  ON bookings
  FOR UPDATE
  USING (auth.uid() = giver_id)
  WITH CHECK (auth.uid() = giver_id);

-- Verify policies are created
-- SELECT policyname, tablename, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'bookings';
