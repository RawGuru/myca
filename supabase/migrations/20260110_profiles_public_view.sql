-- Profiles Public View Migration
-- Replaces column-level REVOKE with a secure public view

-- =====================================================
-- CREATE PUBLIC-SAFE VIEW (excludes email column)
-- =====================================================

-- Create view that exposes only public-safe profile columns
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  name,
  bio,
  tagline,
  video_url,
  rate_per_30,
  qualities_offered,
  is_giver,
  available,
  created_at,
  updated_at,
  timezone,
  profile_picture_url,
  photo_url,
  sessions_completed
FROM public.profiles;

-- Grant SELECT on view to anon and authenticated roles
GRANT SELECT ON public.profiles_public TO anon;
GRANT SELECT ON public.profiles_public TO authenticated;

-- Revoke direct SELECT on profiles table to force use of the view
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. View excludes: email, availability_schedule, stripe_account_id,
--    stripe_onboarding_complete, age_verified_at
-- 2. Direct table SELECT revoked - clients must use profiles_public view
-- 3. View runs with definer permissions (postgres/service role)
