// Supabase Edge Function: Stripe Webhook Handler
// Processes Stripe events and updates database accordingly

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')

  if (!signature || !webhookSecret) {
    return new Response(
      JSON.stringify({ error: 'Missing signature or webhook secret' }),
      { status: 400 }
    )
  }

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    console.log(`Processing webhook event: ${event.type}`)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const { booking_id, type } = paymentIntent.metadata

        if (type === 'booking') {
          // Update booking to confirmed
          const { error } = await supabase
            .from('bookings')
            .update({
              status: 'confirmed',
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', booking_id)

          if (error) {
            console.error('Failed to update booking:', error)
            throw error
          }

          console.log(`Booking ${booking_id} confirmed`)
        } else if (type === 'extension') {
          // Update extension record
          const { error } = await supabase
            .from('extensions')
            .update({
              stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('booking_id', booking_id)
            .is('stripe_payment_intent_id', null)
            .order('created_at', { ascending: false })
            .limit(1)

          if (error) {
            console.error('Failed to update extension:', error)
            throw error
          }

          console.log(`Extension for booking ${booking_id} confirmed`)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const { booking_id, type } = paymentIntent.metadata

        console.error(`Payment failed for ${type} ${booking_id}:`, paymentIntent.last_payment_error?.message)

        if (type === 'booking') {
          // Mark booking as payment failed
          await supabase
            .from('bookings')
            .update({ status: 'cancelled', cancelled_by: 'system' })
            .eq('id', booking_id)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Webhook processing failed' }),
      { status: 400 }
    )
  }
})
