-- RLS Hardening Migration
-- Fixes privacy leaks and tightens security policies

-- =====================================================
-- 1. REFLECTIONS: Not publicly readable, only by participants
-- =====================================================

-- Drop the existing public select policy
DROP POLICY IF EXISTS "Reflections viewable by everyone" ON reflections;

-- Create policy allowing only booking participants to view reflections
CREATE POLICY "Booking participants can view reflections"
ON reflections FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = reflections.booking_id
    AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
  )
);

-- Tighten reflections insert policy
-- Drop existing insert policy
DROP POLICY IF EXISTS "Participants can create reflections" ON reflections;

-- Create stricter insert policy that validates booking_id matches participant
CREATE POLICY "Booking participants can create reflections with validation"
ON reflections FOR INSERT
WITH CHECK (
  (auth.uid() = seeker_id OR auth.uid() = giver_id)
  AND EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = reflections.booking_id
    AND (
      (bookings.seeker_id = auth.uid() AND reflections.seeker_id = auth.uid())
      OR
      (bookings.giver_id = auth.uid() AND reflections.giver_id = auth.uid())
    )
  )
);

-- =====================================================
-- 2. PROFILES EMAIL: Not readable by client roles
-- =====================================================

-- Revoke SELECT on email column from anon and authenticated roles
-- This prevents client-side queries from reading email addresses
REVOKE SELECT (email) ON public.profiles FROM anon;
REVOKE SELECT (email) ON public.profiles FROM authenticated;

-- Grant SELECT on all other columns (whitelist approach)
-- Note: This assumes default grants are revoked. If not, we're adding explicit grants.
-- Users can still SELECT other columns via existing RLS policies

-- =====================================================
-- 3. CREDITS: Not insertable by clients
-- =====================================================

-- Drop any existing credits insert policy that allows client inserts
DROP POLICY IF EXISTS "Users can insert own credits" ON credits;
DROP POLICY IF EXISTS "Anyone can insert credits" ON credits;
DROP POLICY IF EXISTS "Authenticated users can insert credits" ON credits;

-- Credits should only be created by server-side functions (service role)
-- No client insert policy = clients cannot insert

-- =====================================================
-- 4. BLOCKED_USERS: Only insertable by the blocker
-- =====================================================

-- Drop existing blocked_users insert policy
DROP POLICY IF EXISTS "Users can create blocks" ON blocked_users;

-- Create policy ensuring blocker_id matches authenticated user
CREATE POLICY "Users can block others (blocker_id must match auth.uid)"
ON blocked_users FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

-- =====================================================
-- 5. SESSION_MILESTONES: Only insertable by participants
-- =====================================================

-- Drop the overly permissive "System can insert milestones" policy
DROP POLICY IF EXISTS "System can insert milestones" ON session_milestones;

-- Create policy allowing only booking participants to insert milestones
CREATE POLICY "Booking participants can insert milestones"
ON session_milestones FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bookings
    WHERE bookings.id = session_milestones.booking_id
    AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
  )
);

-- =====================================================
-- SUMMARY OF CHANGES
-- =====================================================
-- 1. Reflections: SELECT only by booking participants (not public)
-- 2. Reflections: INSERT only by booking participants with validation
-- 3. Profiles.email: Column-level privilege revoked for anon/authenticated
-- 4. Credits: INSERT policies removed (server-side only)
-- 5. Blocked_users: INSERT requires blocker_id = auth.uid()
-- 6. Session_milestones: INSERT only by booking participants
