#!/bin/bash
set -euo pipefail

# Script to run all schema documentation queries
# Usage:
#   export SUPABASE_DB_HOST=...
#   export SUPABASE_DB_PASSWORD=...
#   ./run_all_queries.sh

: "${SUPABASE_DB_HOST:?Missing SUPABASE_DB_HOST}"
: "${SUPABASE_DB_PASSWORD:?Missing SUPABASE_DB_PASSWORD}"
: "${SUPABASE_DB_USER:=postgres}"
: "${SUPABASE_DB_NAME:=postgres}"
: "${SUPABASE_DB_PORT:=5432}"

OUTPUT_DIR="$(dirname "$0")/outputs"
mkdir -p "$OUTPUT_DIR"

DB_URL="postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}"

echo "Running schema documentation queries..."
echo "1. Fetching column types and details..."
psql "$DB_URL" -f "$(dirname "$0")/01_column_types.sql" -o "$OUTPUT_DIR/01_column_types.txt"

echo "2. Fetching RLS policies..."
psql "$DB_URL" -f "$(dirname "$0")/02_rls_policies.sql" -o "$OUTPUT_DIR/02_rls_policies.txt"

echo "3. Fetching indexes..."
psql "$DB_URL" -f "$(dirname "$0")/03_indexes.sql" -o "$OUTPUT_DIR/03_indexes.txt"

echo "✅ All queries completed! Results saved to: $OUTPUT_DIR"
