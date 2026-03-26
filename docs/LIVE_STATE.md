# LIVE STATE

## Current blocker
Production test required: verify no 406 errors, timer visible in all phases, clean post-join state.

## What is proven
- Session row created early in joinSession() before screen transition (commit 8695703)
- Polling uses .maybeSingle() with graceful zero-row handling (commit 8695703)
- Timer visible in ALL phases: Transmission, Reflection, Validation, Direction (commit 8695703)
- Comprehensive post-join logging added: booking_id, role, session found/created, phase, timestamps, mic state (commit 8695703)
- Build passes with no TypeScript errors
- Leave button gated on dailyMeetingJoined (commit 00529e0)
- SessionStateMachine gated on dailyMeetingJoined (commit 5acd7cb)
- ReceiverInitiatedExtension gated on dailyMeetingJoined (commit 5acd7cb)

## What is not yet proven
- No 406/PGRST116 errors in production after fix
- Timer displays correctly on mobile and desktop
- Phase indicators and role instructions clear to users
- Daily prejoin accessibility on Chromebook (previous blocker)

## Parked issues
- Supabase CLI 401 (requires manual token generation from user)
- Daily prejoin Chromebook testing (previous blocker, now secondary)

## Latest evidence
**2026-03-26 commit da765ba**
- Test: git merge fix/session-bootstrap-timer-sync to main
- Result: Fast-forward merge successful, pushed to origin/main
- Changed: src/App.tsx, src/SessionStateMachine.tsx, src/components/session/PhaseComponents.tsx, docs/LIVE_STATE.md
- Root cause identified: Session row created too late, polling used .single(), timer only in Direction phase
- Fix: Early upsert session_states row, .maybeSingle() polling, timer in all phases, enhanced logging

## Current production state
Frontend commit: da765ba (main branch)
Edge function deploy state: ensure-fresh-room active
Secrets state: DAILY_API_KEY configured, SUPABASE_SERVICE_ROLE_KEY configured
Active environment: Production (merged to main)

## Next single action
Production test on two devices: verify no 406 errors, timer visible in all phases, clean post-join logs.

## If next action fails
Branch 1: If still 406 errors → check session_states RLS policies, verify upsert completes
Branch 2: If timer not visible → check sessionTimeRemaining propagation to phase components
Branch 3: If session row not created → check joinSession() upsert error handling and logs

## Changelog
**2026-03-26 8695703** - Fixed post-join session orchestration: early session row creation, .maybeSingle() polling, timer in all phases, enhanced logging
**2026-03-26 00529e0** - Gated Leave button on dailyMeetingJoined, completing UI gating fix
**2026-03-26 5acd7cb** - Gated SessionStateMachine and ReceiverInitiatedExtension on dailyMeetingJoined, moved Leave button to top-right, changed to 100dvh, reduced phase component spacing
**2026-03-26 1ba4152** - Added explicit Authorization header to ensure-fresh-room calls
**2026-03-26 8adb5ba** - Removed video_room_url requirement from Join button visibility (3 locations)
**2026-03-26 f512ea0** - Added Daily API key diagnostics and request/response logging to ensure-fresh-room
**2026-03-26 ddc105c** - Added proof-of-execution logging to ensure-fresh-room function
