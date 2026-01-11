BEGIN;

-- Final profiles security configuration
-- Goal: authenticated can insert/update their own profile row
-- Goal: no client-role can SELECT from public.profiles (email stays private)

-- Clear all grants (including default PUBLIC)
REVOKE ALL ON TABLE public.profiles FROM public;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;

-- Grant only INSERT and UPDATE to authenticated
GRANT INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- Ensure RLS is on (and forced)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Drop any old/unsafe policies (including any SELECT policy)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write_own_update" ON public.profiles;

-- Recreate only the write policies
CREATE POLICY "profiles_write_own_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_write_own_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

COMMIT;
