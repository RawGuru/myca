-- Run this query in Supabase SQL Editor to check current RLS policies on bookings table

-- Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'bookings';

-- Check all current policies on bookings table
SELECT
  policyname as policy_name,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression,
  roles
FROM pg_policies
WHERE tablename = 'bookings'
ORDER BY policyname;

-- Check bookings table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'bookings'
ORDER BY ordinal_position;
