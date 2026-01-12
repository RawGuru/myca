// Supabase Edge Function: Check Stripe Connect Account Status
// Verifies if a Connect account has completed onboarding

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StatusCheckRequest {
  user_id: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client for auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Initialize Supabase service role client for database updates
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const { user_id }: StatusCheckRequest = await req.json()

    console.log('[CHECK-CONNECT-STATUS] Function invoked', {
      user_id,
      authenticated_user_id: user.id,
      timestamp: new Date().toISOString()
    })

    // Validate user_id matches authenticated user
    if (user_id !== user.id) {
      console.error('[CHECK-CONNECT-STATUS] User ID mismatch', {
        requested_user_id: user_id,
        authenticated_user_id: user.id
      })
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get user's Connect account ID (use admin for read)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user_id)
      .single()

    console.log('[CHECK-CONNECT-STATUS] Retrieved profile from DB', {
      user_id,
      stripe_account_id: profile?.stripe_account_id || 'NULL',
      has_account_id: !!profile?.stripe_account_id
    })

    if (!profile?.stripe_account_id) {
      console.log('[CHECK-CONNECT-STATUS] No stripe_account_id found, returning incomplete')
      return new Response(
        JSON.stringify({
          onboarding_complete: false,
          details_submitted: false,
          charges_enabled: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Retrieve account from Stripe using REST API
    const stripeResponse = await fetch(`https://api.stripe.com/v1/accounts/${profile.stripe_account_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`
      }
    })

    if (!stripeResponse.ok) {
      const errorText = await stripeResponse.text()
      console.error('[CHECK-CONNECT-STATUS] Stripe API error', {
        status: stripeResponse.status,
        error: errorText
      })
      throw new Error(`Stripe API error: ${stripeResponse.status}`)
    }

    const account = await stripeResponse.json()

    const onboardingComplete = account.details_submitted && account.charges_enabled && account.payouts_enabled

    console.log('[CHECK-CONNECT-STATUS] Retrieved account from Stripe', {
      user_id,
      stripe_account_id: profile.stripe_account_id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      onboarding_complete: onboardingComplete
    })

    // Update database with onboarding status (service role)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_account_id: profile.stripe_account_id,
        stripe_onboarding_complete: onboardingComplete,
      })
      .eq('id', user_id)

    if (updateError) {
      console.error('[CHECK-CONNECT-STATUS] Failed to update onboarding status', {
        user_id,
        error: updateError
      })
    } else {
      console.log('[CHECK-CONNECT-STATUS] Successfully updated DB', {
        user_id,
        stripe_account_id: profile.stripe_account_id,
        stripe_onboarding_complete: onboardingComplete
      })
    }

    return new Response(
      JSON.stringify({
        onboarding_complete: onboardingComplete,
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Connect status check error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to check Connect status'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
