-- Allow authenticated users to SELECT their own profile row
-- This enables users to read private fields like stripe_account_id for their own profile

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
