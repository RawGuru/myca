-- Create RPC functions to increment giver accountability counters
-- These ensure atomic updates for tracking session completion and late joins

-- Function to increment total_sessions_completed
CREATE OR REPLACE FUNCTION increment_sessions_completed(giver_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET total_sessions_completed = COALESCE(total_sessions_completed, 0) + 1
  WHERE id = giver_user_id AND is_giver = true;
END;
$$;

-- Function to increment times_joined_late
CREATE OR REPLACE FUNCTION increment_times_joined_late(giver_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET times_joined_late = COALESCE(times_joined_late, 0) + 1
  WHERE id = giver_user_id AND is_giver = true;
END;
$$;

COMMENT ON FUNCTION increment_sessions_completed IS 'Atomically increment giver session completion counter';
COMMENT ON FUNCTION increment_times_joined_late IS 'Atomically increment giver late join counter';
