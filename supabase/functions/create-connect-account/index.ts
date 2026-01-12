// Supabase Edge Function: Create Stripe Connect Account
// Handles Stripe Connect Express account creation and onboarding for givers

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ConnectAccountRequest {
  email: string
  user_id: string
  refresh_url?: string
  return_url?: string
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

    const { email, user_id, refresh_url, return_url }: ConnectAccountRequest = await req.json()

    // Validate user_id matches authenticated user
    if (user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'User ID mismatch' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user already has a Connect account (use admin for read)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarding_complete')
      .eq('id', user_id)
      .single()

    let accountId = profile?.stripe_account_id

    // Create new Connect account if doesn't exist
    if (!accountId) {
      // Create account using Stripe REST API
      const accountParams = new URLSearchParams({
        'type': 'express',
        'email': email,
        'capabilities[card_payments][requested]': 'true',
        'capabilities[transfers][requested]': 'true',
        'business_type': 'individual',
        'metadata[user_id]': user_id
      })

      const accountResponse = await fetch('https://api.stripe.com/v1/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: accountParams.toString()
      })

      if (!accountResponse.ok) {
        const errorText = await accountResponse.text()
        console.error('Stripe account creation error:', errorText)
        throw new Error(`Failed to create Stripe account: ${accountResponse.status}`)
      }

      const account = await accountResponse.json()
      accountId = account.id

      // Save account ID to database immediately (service role)
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          stripe_account_id: accountId,
          stripe_onboarding_complete: false,
        })
        .eq('id', user_id)

      if (updateError) {
        console.error('Failed to save stripe_account_id:', updateError)
        throw new Error('Failed to save Connect account ID')
      }
    }

    // Create Account Link for onboarding using Stripe REST API
    const linkParams = new URLSearchParams({
      'account': accountId,
      'refresh_url': refresh_url || 'https://myca-six.vercel.app/#/bookings',
      'return_url': return_url || 'https://myca-six.vercel.app/#/payout-setup-complete',
      'type': 'account_onboarding'
    })

    const linkResponse = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: linkParams.toString()
    })

    if (!linkResponse.ok) {
      const errorText = await linkResponse.text()
      console.error('Stripe account link creation error:', errorText)
      throw new Error(`Failed to create account link: ${linkResponse.status}`)
    }

    const accountLink = await linkResponse.json()

    return new Response(
      JSON.stringify({
        account_id: accountId,
        onboarding_url: accountLink.url,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Connect account creation error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create Connect account'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
