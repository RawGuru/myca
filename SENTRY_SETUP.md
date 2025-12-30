# Sentry Error Monitoring Setup

Sentry is now integrated for automatic error tracking and alerts.

## Quick Setup (5 minutes)

### 1. Create Sentry Account
1. Go to https://sentry.io/signup/
2. Sign up (free tier: 5,000 errors/month)
3. Create a new project:
   - Platform: **React**
   - Project name: **myca** (or whatever you want)

### 2. Get Your DSN
1. After creating project, copy your DSN
2. It looks like: `https://abc123@o123456.ingest.sentry.io/123456`

### 3. Add DSN to .env
```bash
# In your .env file, uncomment and add your DSN:
VITE_SENTRY_DSN=https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
```

### 4. Restart Dev Server
```bash
npm run dev
```

### 5. Test It Works
1. Go to http://localhost:5173
2. Open browser console
3. Run: `throw new Error("Test Sentry!")`
4. Check Sentry dashboard - you should see the error

## Features Enabled

✅ **Automatic error capture** - All uncaught errors sent to Sentry
✅ **React error boundary** - Catches component errors
✅ **Session replay** - Watch user's session before error (100% of errors, 10% of normal sessions)
✅ **Performance monitoring** - Track slow operations (10% sample)
✅ **Production only** - Disabled in development to avoid noise

## Set Up Alerts

1. Go to https://sentry.io/settings/[your-org]/projects/myca/alerts/
2. Default: Email on every new error
3. Optional: Add Slack integration for instant notifications

## What Gets Sent to Sentry

- Error message and stack trace
- URL where error occurred
- User browser/device info
- Session replay (what user did before error)
- Performance data (page load times, etc.)

## Privacy

- Passwords and sensitive inputs are NOT captured
- You can enable `maskAllText: true` in main.tsx to hide all user text
- Session replays are only stored for 30 days

## Disable Sentry

To temporarily disable:
```bash
# Comment out in .env:
# VITE_SENTRY_DSN=...
```

Or set `enabled: false` in `src/main.tsx`
