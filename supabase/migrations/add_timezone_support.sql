-- Add timezone support for users
-- Times are stored in the user's local timezone and converted when displayed

-- Add timezone to profiles table (for givers)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Create user_profiles table for all users (givers and seekers)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Anyone can view other users' profiles (for timezone conversion)
CREATE POLICY "Anyone can view profiles"
  ON user_profiles FOR SELECT
  USING (true);

COMMENT ON TABLE user_profiles IS 'User profiles with timezone information for proper time conversion';
COMMENT ON COLUMN profiles.timezone IS 'Giver timezone - used to interpret their availability times';
COMMENT ON COLUMN user_profiles.timezone IS 'User timezone - used to display times in their local timezone';
