-- Migration: Add CASCADE DELETE to all foreign keys
-- Purpose: Deleting a user/profile automatically deletes all related data

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Profile deletion cascades from auth.users

ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================
-- LISTINGS TABLE
-- ============================================
-- Listing deletion cascades when user is deleted

ALTER TABLE listings
DROP CONSTRAINT IF EXISTS listings_user_id_fkey;

ALTER TABLE listings
ADD CONSTRAINT listings_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================
-- GIVER_AVAILABILITY TABLE
-- ============================================
-- Availability deletion cascades when giver profile is deleted

ALTER TABLE giver_availability
DROP CONSTRAINT IF EXISTS giver_availability_giver_id_fkey;

ALTER TABLE giver_availability
ADD CONSTRAINT giver_availability_giver_id_fkey
FOREIGN KEY (giver_id) REFERENCES profiles(id)
ON DELETE CASCADE;

-- ============================================
-- GIVER_METRICS TABLE
-- ============================================
-- Metrics deletion cascades when giver profile is deleted

ALTER TABLE giver_metrics
DROP CONSTRAINT IF EXISTS giver_metrics_giver_id_fkey;

ALTER TABLE giver_metrics
ADD CONSTRAINT giver_metrics_giver_id_fkey
FOREIGN KEY (giver_id) REFERENCES profiles(id)
ON DELETE CASCADE;

-- ============================================
-- BOOKINGS TABLE
-- ============================================
-- Bookings cascade when either seeker or giver auth user is deleted

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_seeker_id_fkey;

ALTER TABLE bookings
ADD CONSTRAINT bookings_seeker_id_fkey
FOREIGN KEY (seeker_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_giver_id_fkey;

ALTER TABLE bookings
ADD CONSTRAINT bookings_giver_id_fkey
FOREIGN KEY (giver_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS bookings_listing_id_fkey;

ALTER TABLE bookings
ADD CONSTRAINT bookings_listing_id_fkey
FOREIGN KEY (listing_id) REFERENCES listings(id)
ON DELETE SET NULL; -- Listing can be deleted without deleting booking

-- ============================================
-- SESSION_STATES TABLE
-- ============================================
-- Session states cascade when booking is deleted

ALTER TABLE session_states
DROP CONSTRAINT IF EXISTS session_states_booking_id_fkey;

ALTER TABLE session_states
ADD CONSTRAINT session_states_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES bookings(id)
ON DELETE CASCADE;

ALTER TABLE session_states
DROP CONSTRAINT IF EXISTS session_states_extension_id_fkey;

ALTER TABLE session_states
ADD CONSTRAINT session_states_extension_id_fkey
FOREIGN KEY (extension_id) REFERENCES extensions(id)
ON DELETE SET NULL; -- Extension can be deleted without deleting session state

ALTER TABLE session_states
DROP CONSTRAINT IF EXISTS session_states_updated_by_fkey;

ALTER TABLE session_states
ADD CONSTRAINT session_states_updated_by_fkey
FOREIGN KEY (updated_by) REFERENCES auth.users(id)
ON DELETE SET NULL; -- User deletion doesn't break session state audit trail

-- ============================================
-- SESSION_MILESTONES TABLE
-- ============================================
-- Milestones cascade when booking is deleted

ALTER TABLE session_milestones
DROP CONSTRAINT IF EXISTS session_milestones_booking_id_fkey;

ALTER TABLE session_milestones
ADD CONSTRAINT session_milestones_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES bookings(id)
ON DELETE CASCADE;

ALTER TABLE session_milestones
DROP CONSTRAINT IF EXISTS session_milestones_user_id_fkey;

ALTER TABLE session_milestones
ADD CONSTRAINT session_milestones_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id)
ON DELETE SET NULL; -- Keep milestone for audit even if user deleted

-- ============================================
-- EXTENSIONS TABLE
-- ============================================
-- Extensions cascade when booking is deleted

ALTER TABLE extensions
DROP CONSTRAINT IF EXISTS extensions_booking_id_fkey;

ALTER TABLE extensions
ADD CONSTRAINT extensions_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES bookings(id)
ON DELETE CASCADE;

ALTER TABLE extensions
DROP CONSTRAINT IF EXISTS extensions_requested_by_fkey;

ALTER TABLE extensions
ADD CONSTRAINT extensions_requested_by_fkey
FOREIGN KEY (requested_by) REFERENCES auth.users(id)
ON DELETE SET NULL; -- Keep extension record even if requester deleted

-- ============================================
-- FEEDBACK TABLE
-- ============================================
-- Feedback cascades when booking is deleted

ALTER TABLE feedback
DROP CONSTRAINT IF EXISTS feedback_booking_id_fkey;

ALTER TABLE feedback
ADD CONSTRAINT feedback_booking_id_fkey
FOREIGN KEY (booking_id) REFERENCES bookings(id)
ON DELETE CASCADE;

ALTER TABLE feedback
DROP CONSTRAINT IF EXISTS feedback_giver_id_fkey;

ALTER TABLE feedback
ADD CONSTRAINT feedback_giver_id_fkey
FOREIGN KEY (giver_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

ALTER TABLE feedback
DROP CONSTRAINT IF EXISTS feedback_seeker_id_fkey;

ALTER TABLE feedback
ADD CONSTRAINT feedback_seeker_id_fkey
FOREIGN KEY (seeker_id) REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================
-- HELPER FUNCTION: delete_user_completely
-- ============================================
-- Deletes a user and all their data in one call
-- Usage: SELECT delete_user_completely('user-uuid-here');

CREATE OR REPLACE FUNCTION delete_user_completely(target_user_id UUID)
RETURNS TABLE(
  deleted_profile BOOLEAN,
  deleted_listings INTEGER,
  deleted_availability INTEGER,
  deleted_metrics BOOLEAN,
  deleted_bookings INTEGER,
  deleted_feedback INTEGER,
  deleted_auth_user BOOLEAN,
  success BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges
AS $$
DECLARE
  v_listings_count INTEGER;
  v_availability_count INTEGER;
  v_bookings_count INTEGER;
  v_feedback_count INTEGER;
  v_profile_exists BOOLEAN;
  v_auth_user_exists BOOLEAN;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = target_user_id) INTO v_profile_exists;

  -- Check if auth user exists
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = target_user_id) INTO v_auth_user_exists;

  -- Count records before deletion (for reporting)
  SELECT COUNT(*) INTO v_listings_count FROM listings WHERE user_id = target_user_id;
  SELECT COUNT(*) INTO v_availability_count FROM giver_availability WHERE giver_id = target_user_id;
  SELECT COUNT(*) INTO v_bookings_count FROM bookings WHERE seeker_id = target_user_id OR giver_id = target_user_id;
  SELECT COUNT(*) INTO v_feedback_count FROM feedback WHERE seeker_id = target_user_id OR giver_id = target_user_id;

  -- Delete profile (cascades to listings, availability, metrics, bookings, feedback, etc.)
  IF v_profile_exists THEN
    DELETE FROM profiles WHERE id = target_user_id;
  END IF;

  -- Delete auth user (cascades to profile if it still exists)
  IF v_auth_user_exists THEN
    DELETE FROM auth.users WHERE id = target_user_id;
  END IF;

  -- Return deletion summary
  RETURN QUERY SELECT
    v_profile_exists AS deleted_profile,
    v_listings_count AS deleted_listings,
    v_availability_count AS deleted_availability,
    EXISTS(SELECT 1 FROM giver_metrics WHERE giver_id = target_user_id) AS deleted_metrics,
    v_bookings_count AS deleted_bookings,
    v_feedback_count AS deleted_feedback,
    v_auth_user_exists AS deleted_auth_user,
    TRUE AS success;
END;
$$;

-- Grant execute permission to authenticated users (for self-deletion)
GRANT EXECUTE ON FUNCTION delete_user_completely(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_user_completely IS 'Completely deletes a user and all their related data (listings, bookings, feedback, etc.)';
