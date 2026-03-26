#!/bin/bash
# Terminal repro for ensure-fresh-room 401 diagnosis
# Usage: ./test-ensure-fresh-room.sh <USER_ACCESS_TOKEN> <BOOKING_ID>

USER_ACCESS_TOKEN="${1:-YOUR_ACCESS_TOKEN_HERE}"
BOOKING_ID="${2:-YOUR_BOOKING_ID_HERE}"
FUNCTION_URL="https://ksramckuggspsqymcjpo.supabase.co/functions/v1/ensure-fresh-room"
APIKEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcmFtY2t1Z2dzcHNxeW1janBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTMwODgsImV4cCI6MjA4MTgyOTA4OH0.CszijxFZU09QKH2aJbv6TjniWUJ1muJDnHXSe_u8DJc"

echo "=== ENSURE-FRESH-ROOM TERMINAL REPRO ==="
echo "Function URL: $FUNCTION_URL"
echo "apikey header: ${APIKEY:0:20}..."
echo "Authorization token: ${USER_ACCESS_TOKEN:0:20}..."
echo "Booking ID: $BOOKING_ID"
echo ""

echo "=== SENDING REQUEST ==="
curl -v \
  -X POST \
  -H "Content-Type: application/json" \
  -H "apikey: $APIKEY" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -d "{\"booking_id\":\"$BOOKING_ID\"}" \
  "$FUNCTION_URL"

echo ""
echo ""
echo "=== EXPECTED RESPONSES ==="
echo "200 OK: {\"video_room_url\":\"...\",\"was_refreshed\":true/false}"
echo "400 Bad Request: {\"error\":\"Missing booking_id\",\"stage\":\"validation_failed\"}"
echo "401 Unauthorized: Gateway rejection BEFORE function execution"
echo "404 Not Found: {\"error\":\"Booking not found\",\"stage\":\"booking_lookup_failed\"}"
echo "500 Internal Server Error: {\"error\":\"...\",\"stage\":\"missing_daily_api_key\" or \"daily_room_create_failed\"}"
