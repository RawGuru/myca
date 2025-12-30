// Supabase Edge Function: Finalize Session
// Full payout policy - no pro-rating, platform credits for safety exits

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

    console.log(`[Finalize Session] Elapsed: ${elapsedSeconds}s`)

    // PAYOUT POLICY (No Pro-rating)
    let payoutNetCents = 0
    let refundGrossCents = 0
    let creditAmountCents = 0

    const totalAmountCents = booking.total_amount_cents || 0
    const platformFeeCents = booking.platform_fee_cents || 0
    const giverPayoutCents = booking.giver_payout_cents || 0

    switch (end_reason) {
      case 'receiver_end_complete':
      case 'completed':
        // Full payout, no refund
        payoutNetCents = giverPayoutCents
        refundGrossCents = 0
        creditAmountCents = 0
        console.log('[Finalize Session] Policy: Full payout (session completed)')
        break

      case 'giver_safety_exit':
        // Full payout to giver, platform credit to receiver, no cash refund
        payoutNetCents = giverPayoutCents
        refundGrossCents = 0
        creditAmountCents = platformFeeCents  // Receiver gets platform fee as credit
        console.log(`[Finalize Session] Policy: Full payout + ${creditAmountCents} credit (safety exit)`)
        break

      case 'technical_failure':
        // Full payout, no refund (platform absorbs cost)
        payoutNetCents = giverPayoutCents
        refundGrossCents = 0
        creditAmountCents = 0
        console.log('[Finalize Session] Policy: Full payout (technical failure)')
        break

      case 'receiver_no_show':
        // Full refund to receiver, no payout to giver
        payoutNetCents = 0
        refundGrossCents = totalAmountCents
        creditAmountCents = 0
        console.log('[Finalize Session] Policy: Full refund (receiver no-show)')
        break

      case 'giver_no_show':
        // Full refund to receiver
        payoutNetCents = 0
        refundGrossCents = totalAmountCents
        creditAmountCents = 0
        console.log('[Finalize Session] Policy: Full refund (giver no-show)')
        break

      default:
        throw new Error(`Unknown end_reason: ${end_reason}`)
    }

    console.log(`[Finalize Session] Amounts: payout=${payoutNetCents}, refund=${refundGrossCents}, credit=${creditAmountCents}`)

    // Stripe operations
    const paymentIntentId = booking.stripe_payment_intent_id

    if (!paymentIntentId) {
      throw new Error('No payment intent found for booking')
    }

    // Process refund if needed (only for no-shows)
    if (refundGrossCents > 0) {
      console.log(`[Finalize Session] Creating Stripe refund for ${refundGrossCents} cents`)

      try {
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
          amount: refundGrossCents,
          reason: 'requested_by_customer',
        })
        console.log('[Finalize Session] Stripe refund created successfully')
      } catch (stripeError: any) {
        console.error('[Finalize Session] Stripe refund failed:', stripeError.message)
        // Don't throw - still update database with failed status
      }
    }

    // Create platform credit if needed (safety exit)
    if (creditAmountCents > 0) {
      console.log(`[Finalize Session] Creating ${creditAmountCents} cents credit for user ${booking.seeker_id}`)

      try {
        const { error: creditError } = await supabase
          .from('credits')
          .insert({
            user_id: booking.seeker_id,
            amount_cents: creditAmountCents,
            source_booking_id: booking_id,
            reason: 'giver_safety_exit'
          })

        if (creditError) {
          console.error('[Finalize Session] Credit creation failed:', creditError.message)
        } else {
          console.log('[Finalize Session] Credit created successfully')
        }
      } catch (creditErr: any) {
        console.error('[Finalize Session] Credit creation error:', creditErr.message)
      }
    }

    // Create credit if giver joined late (seeker_credit_earned flag)
    if (booking.seeker_credit_earned && (end_reason === 'completed' || end_reason === 'receiver_end_complete')) {
      const lateCreditAmount = platformFeeCents // Seeker gets platform fee back as credit
      console.log(`[Finalize Session] Creating late-join credit: ${lateCreditAmount} cents for user ${booking.seeker_id}`)

      try {
        const { error: lateCreditError } = await supabase
          .from('credits')
          .insert({
            user_id: booking.seeker_id,
            amount_cents: lateCreditAmount,
            source_booking_id: booking_id,
            reason: 'giver_joined_late'
          })

        if (lateCreditError) {
          console.error('[Finalize Session] Late-join credit creation failed:', lateCreditError.message)
        } else {
          console.log('[Finalize Session] Late-join credit created successfully')
        }
      } catch (lateCreditErr: any) {
        console.error('[Finalize Session] Late-join credit creation error:', lateCreditErr.message)
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
        payout_status: 'completed',
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
        credit_amount_cents: creditAmountCents,
        elapsed_seconds: elapsedSeconds,
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
