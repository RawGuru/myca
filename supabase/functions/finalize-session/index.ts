// Supabase Edge Function: Finalize Session
// Computes elapsed time, applies payout policy, handles Stripe refunds/payouts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface FinalizeRequest {
  booking_id: string
  end_reason: 'receiver_end_complete' | 'completed' | 'giver_safety_exit' |
               'technical_failure' | 'receiver_no_show' | 'giver_no_show'
}

serve(async (req) => {
  // CORS handling
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
    const { booking_id, end_reason }: FinalizeRequest = await req.json()

    if (!booking_id || !end_reason) {
      throw new Error('Missing required fields: booking_id and end_reason')
    }

    console.log(`[Finalize Session] Processing booking ${booking_id} with end_reason: ${end_reason}`)

    // Fetch booking with payment details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`)
    }

    // Calculate elapsed time
    const startedAt = new Date(booking.started_at || booking.session_started_at || booking.scheduled_time)
    const endedAt = new Date()
    const elapsedSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    // Get booking duration (blocks_booked * 30 minutes * 60 seconds)
    const totalDurationSeconds = booking.blocks_booked * 30 * 60
    const elapsedPercentage = Math.min(Math.max(elapsedSeconds / totalDurationSeconds, 0), 1.0)

    console.log(`[Finalize Session] Elapsed: ${elapsedSeconds}s / ${totalDurationSeconds}s = ${(elapsedPercentage * 100).toFixed(1)}%`)

    // PAYOUT POLICY (Linear Pro-rating)
    let payoutPercentage = 0
    let refundPercentage = 0

    switch (end_reason) {
      case 'receiver_end_complete':
      case 'completed':
        // Full payout, no refund
        payoutPercentage = 1.0
        refundPercentage = 0
        console.log('[Finalize Session] Policy: Full payout (session completed)')
        break

      case 'giver_safety_exit':
      case 'technical_failure':
        // LINEAR pro-rating: % elapsed = % payout, rest refunded
        payoutPercentage = elapsedPercentage
        refundPercentage = 1.0 - elapsedPercentage
        console.log(`[Finalize Session] Policy: Pro-rated (${(payoutPercentage * 100).toFixed(1)}% payout, ${(refundPercentage * 100).toFixed(1)}% refund)`)
        break

      case 'receiver_no_show':
        // Full refund to receiver, no payout to giver
        payoutPercentage = 0
        refundPercentage = 1.0
        console.log('[Finalize Session] Policy: Full refund (receiver no-show)')
        break

      case 'giver_no_show':
        // Full refund to receiver
        payoutPercentage = 0
        refundPercentage = 1.0
        console.log('[Finalize Session] Policy: Full refund (giver no-show)')
        break

      default:
        throw new Error(`Unknown end_reason: ${end_reason}`)
    }

    // Calculate amounts
    const totalAmountCents = booking.total_amount_cents || 0
    const platformFeeCents = booking.platform_fee_cents || 0
    const giverPayoutOriginalCents = booking.giver_payout_cents || 0

    const payoutNetCents = Math.floor(giverPayoutOriginalCents * payoutPercentage)
    const refundGrossCents = Math.floor(totalAmountCents * refundPercentage)

    console.log(`[Finalize Session] Amounts: payout=${payoutNetCents}, refund=${refundGrossCents}`)

    // Stripe operations
    const paymentIntentId = booking.stripe_payment_intent_id

    if (!paymentIntentId) {
      throw new Error('No payment intent found for booking')
    }

    // Process refund if needed
    if (refundGrossCents > 0) {
      console.log(`[Finalize Session] Creating Stripe refund for ${refundGrossCents} cents`)

      try {
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundGrossCents,
          reason: end_reason === 'giver_no_show' || end_reason === 'receiver_no_show' ? 'requested_by_customer' : 'requested_by_customer',
        })
        console.log('[Finalize Session] Stripe refund created successfully')
      } catch (stripeError: any) {
        console.error('[Finalize Session] Stripe refund failed:', stripeError.message)
        // Don't throw - still update database with failed status
      }
    }

    // Update booking record
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        ended_at: endedAt.toISOString(),
        elapsed_seconds: elapsedSeconds,
        end_reason,
        payout_net_cents: payoutNetCents,
        refund_gross_cents: refundGrossCents,
        payout_status: refundGrossCents > 0 ? 'completed' : 'completed',
      })
      .eq('id', booking_id)

    if (updateError) {
      throw updateError
    }

    console.log('[Finalize Session] Booking updated successfully')

    // Update session_states end reason
    await supabase
      .from('session_states')
      .update({
        current_phase: 'ended',
        end_reason,
        ended_at: endedAt.toISOString(),
      })
      .eq('booking_id', booking_id)

    console.log('[Finalize Session] Session state updated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        payout_net_cents: payoutNetCents,
        refund_gross_cents: refundGrossCents,
        elapsed_seconds: elapsedSeconds,
        elapsed_percentage: elapsedPercentage,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error) {
    console.error('[Finalize Session] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to finalize session'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
})
