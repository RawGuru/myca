-- Update giver_metrics RLS to allow SELECT for discovery ranking
-- Quality score remains invisible to users (not displayed in UI)
-- but can be queried for sorting purposes

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Only system can access giver metrics" ON giver_metrics;

-- Allow SELECT for discovery ranking (data not shown to users, only used for sorting)
CREATE POLICY "Allow read access for discovery ranking"
  ON giver_metrics FOR SELECT
  USING (true);

-- Block all write operations (INSERT/UPDATE/DELETE) from clients
-- Only the trigger function (SECURITY DEFINER) can modify
CREATE POLICY "Only system can modify giver metrics"
  ON giver_metrics FOR INSERT
  USING (false);

CREATE POLICY "Only system can update giver metrics"
  ON giver_metrics FOR UPDATE
  USING (false);

CREATE POLICY "Only system can delete giver metrics"
  ON giver_metrics FOR DELETE
  USING (false);

COMMENT ON POLICY "Allow read access for discovery ranking" ON giver_metrics IS
  'Allows querying quality_score for discovery ranking. Data is never displayed to users per constitution.';
