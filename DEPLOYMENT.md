# Deployment Guide

## Supabase Edge Functions

### Email Service Setup (Critical)

**IMPORTANT:** Resend MUST use a **production API key** in Supabase Function secrets.

#### Why Production Keys Are Required

- **Test keys** (`re_test_...`) block emails to unverified addresses with 403 errors
- **Production keys** (`re_...`) send to any address without domain verification
- Without a production key, emails will fail silently in production

#### Set Resend Production Key

1. Get your **production** API key from https://resend.com/api-keys
   - Do NOT use test keys starting with `re_test_`
   - Use production keys starting with `re_`

2. Set the secret in Supabase:
   ```bash
   # Using Supabase CLI
   supabase secrets set RESEND_API_KEY=re_YOUR_PRODUCTION_KEY_HERE

   # Or via Supabase Dashboard:
   # Project Settings → Edge Functions → Secrets → Add RESEND_API_KEY
   ```

3. Deploy the email function:
   ```bash
   supabase functions deploy send-booking-emails
   ```

4. Verify in function logs:
   ```
   [BOOKING EMAILS] Resend API Key: PRODUCTION (****xxxx)
   ```

#### Required Secrets for Email Functions

Set these in Supabase Edge Function secrets:

```bash
RESEND_API_KEY=re_YOUR_PRODUCTION_KEY        # Production key (NOT test)
EMAIL_FROM=Myca <noreply@yourdomain.com>     # Verified sender
APP_URL=https://yourdomain.com               # For email links
EMAIL_DEBUG=false                            # Set true for verbose logging
```

#### Optional Test Mode

For local testing only, you can override all recipients:

```bash
RESEND_TEST_RECIPIENT=your@email.com         # All emails go here (local testing)
```

**Do NOT set `RESEND_TEST_RECIPIENT` in production** - it will send all customer emails to that address!

### Verify Email Delivery

After deploying with production key:

1. Trigger a booking email (create a test booking)
2. Check email_events table in Supabase:
   ```sql
   SELECT
     event,
     recipient,
     http_status,
     success,
     provider_message_id,
     error_message
   FROM email_events
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. Verify:
   - `http_status` = **200** (not 403)
   - `success` = **true**
   - `provider_message_id` exists
   - No `error_message`

4. Or check in app: Navigate to `/#/admin/email-events`

### Troubleshooting

**403 Forbidden errors:**
- You're using a test key or test mode
- Check function logs for: `Resend API Key: PRODUCTION`
- Verify `RESEND_API_KEY` starts with `re_` (not `re_test_`)

**Emails not received:**
- Check email_events table for errors
- Verify EMAIL_FROM address is verified in Resend dashboard
- Check recipient spam folder

## Database Migrations

Apply migrations to production:

```bash
supabase db push
```

Or run SQL directly in Supabase Dashboard → SQL Editor.

## Frontend Deployment (Vercel)

Environment variables needed in Vercel:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_SENTRY_DSN=https://...
```

Deploy:
```bash
vercel --prod
```
