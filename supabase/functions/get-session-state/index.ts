// Supabase Edge Function: Get Session State
// Computes current phase from booking scheduled_time and returns server-controlled state
// Phase timings: transmission 8min, reflection 8min, validation 4min, emergence 5min (total 25min)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type SessionPhase = 'transmission' | 'reflection' | 'validation' | 'emergence' | 'ended'

interface GetSessionStateRequest {
  booking_id: string
}

interface SessionStateResponse {
  phase: SessionPhase
  giver_can_speak: boolean
  seconds_remaining_in_phase: number
  total_elapsed_seconds: number
}

// Phase durations in seconds
const PHASE_DURATIONS = {
  transmission: 8 * 60,  // 8 minutes
  reflection: 8 * 60,    // 8 minutes
  validation: 4 * 60,    // 4 minutes
  emergence: 5 * 60,     // 5 minutes (formerly emergence, now called direction)
}

const TOTAL_SESSION_DURATION =
  PHASE_DURATIONS.transmission +
  PHASE_DURATIONS.reflection +
  PHASE_DURATIONS.validation +
  PHASE_DURATIONS.emergence  // 25 minutes total

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
    const { booking_id }: GetSessionStateRequest = await req.json()

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing booking_id' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch booking to get scheduled_time
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, scheduled_time, duration_minutes, status')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      console.error('[GET-SESSION-STATE] Booking not found:', bookingError)
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Calculate elapsed time from scheduled_time
    const scheduledTime = new Date(booking.scheduled_time)
    const now = new Date()
    const elapsedSeconds = Math.floor((now.getTime() - scheduledTime.getTime()) / 1000)

    console.log(`[GET-SESSION-STATE] Booking ${booking_id}: elapsed ${elapsedSeconds}s from scheduled time`)

    // Compute current phase based on elapsed time
    let phase: SessionPhase
    let secondsRemainingInPhase: number
    let giverCanSpeak: boolean

    if (elapsedSeconds < 0) {
      // Session hasn't started yet
      phase = 'transmission'
      secondsRemainingInPhase = PHASE_DURATIONS.transmission
      giverCanSpeak = false
    } else if (elapsedSeconds < PHASE_DURATIONS.transmission) {
      // Transmission phase (giver muted)
      phase = 'transmission'
      secondsRemainingInPhase = PHASE_DURATIONS.transmission - elapsedSeconds
      giverCanSpeak = false
    } else if (elapsedSeconds < PHASE_DURATIONS.transmission + PHASE_DURATIONS.reflection) {
      // Reflection phase (both can speak)
      phase = 'reflection'
      const phaseElapsed = elapsedSeconds - PHASE_DURATIONS.transmission
      secondsRemainingInPhase = PHASE_DURATIONS.reflection - phaseElapsed
      giverCanSpeak = true
    } else if (elapsedSeconds < PHASE_DURATIONS.transmission + PHASE_DURATIONS.reflection + PHASE_DURATIONS.validation) {
      // Validation phase (both can speak)
      phase = 'validation'
      const phaseElapsed = elapsedSeconds - PHASE_DURATIONS.transmission - PHASE_DURATIONS.reflection
      secondsRemainingInPhase = PHASE_DURATIONS.validation - phaseElapsed
      giverCanSpeak = true
    } else if (elapsedSeconds < TOTAL_SESSION_DURATION) {
      // Emergence/Direction phase (both can speak)
      phase = 'emergence'
      const phaseElapsed = elapsedSeconds - PHASE_DURATIONS.transmission - PHASE_DURATIONS.reflection - PHASE_DURATIONS.validation
      secondsRemainingInPhase = PHASE_DURATIONS.emergence - phaseElapsed
      giverCanSpeak = true
    } else {
      // Session ended
      phase = 'ended'
      secondsRemainingInPhase = 0
      giverCanSpeak = true
    }

    // Update session_states table with current phase and giver_can_speak
    // This ensures the database reflects server-computed state
    try {
      const { error: updateError } = await supabaseClient
        .from('session_states')
        .upsert({
          booking_id: booking.id,
          current_phase: phase,
          giver_can_speak: giverCanSpeak,
          updated_at: now.toISOString(),
        }, {
          onConflict: 'booking_id'
        })

      if (updateError) {
        console.error('[GET-SESSION-STATE] Failed to update session_states:', updateError)
        // Don't fail the request, just log the error
      }
    } catch (err) {
      console.error('[GET-SESSION-STATE] Error updating session_states:', err)
    }

    const response: SessionStateResponse = {
      phase,
      giver_can_speak: giverCanSpeak,
      seconds_remaining_in_phase: Math.max(0, secondsRemainingInPhase),
      total_elapsed_seconds: elapsedSeconds,
    }

    console.log(`[GET-SESSION-STATE] Returning:`, response)

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error) {
    console.error('[GET-SESSION-STATE] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
})
