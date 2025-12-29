// Supabase Edge Function: Create Stripe PaymentIntent
// Handles payment intents for both bookings and session extensions
// Routes 85% to giver via Stripe Connect, keeps 15% as platform fee

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

interface PaymentRequest {
  amount_cents: number
  booking_id: string
  type: 'booking' | 'extension'
  seeker_email?: string
  giver_id?: string // User ID of the giver to get their Stripe account
}

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { amount_cents, booking_id, type, seeker_email, giver_id }: PaymentRequest = await req.json()

    // Validate request
    if (!amount_cents || !booking_id || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    if (amount_cents < 50) {
      return new Response(
        JSON.stringify({ error: 'Amount must be at least $0.50' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Get giver's Stripe Connect account ID if giver_id provided
    let stripeAccountId: string | null = null
    if (giver_id) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      )

      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_complete')
        .eq('id', giver_id)
        .single()

      if (profile?.stripe_onboarding_complete && profile?.stripe_account_id) {
        stripeAccountId = profile.stripe_account_id
      }
    }

    // PRICING MODEL: Platform fee (15%) is ADDED ON TOP of giver's net price
    // amount_cents = giver's NET price (what they receive)
    // gross_amount = amount charged to receiver (net + platform fee)
    const netAmount = amount_cents
    const grossAmount = Math.ceil(netAmount / (1 - 0.15)) // Add 15% on top, round up
    const platformFeeAmount = grossAmount - netAmount

    // Create PaymentIntent with Connect transfer if giver has account
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: grossAmount, // Charge receiver the GROSS amount
      currency: 'usd',
      metadata: {
        booking_id,
        type,
        giver_id: giver_id || '',
        net_amount: netAmount.toString(), // What giver receives
        platform_fee: platformFeeAmount.toString(),
      },
      description: type === 'booking'
        ? `MYCA Session Booking - ${booking_id}`
        : `MYCA Session Extension - ${booking_id}`,
      receipt_email: seeker_email,
      automatic_payment_methods: {
        enabled: true,
      },
    }

    // Add Connect transfer if giver has completed onboarding
    if (stripeAccountId) {
      paymentIntentParams.application_fee_amount = platformFeeAmount
      paymentIntentParams.transfer_data = {
        destination: stripeAccountId,
      }
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams)

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error) {
    console.error('Payment intent creation error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create payment intent'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
})
