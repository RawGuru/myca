-- Get indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public';
