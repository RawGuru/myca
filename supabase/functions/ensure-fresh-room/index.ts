// Supabase Edge Function: Ensure Fresh Room
// Concurrency-safe Daily room creation with optimistic locking
// Ensures room is < 30 minutes old to avoid expired room errors

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface EnsureFreshRoomRequest {
  booking_id: string
}

interface EnsureFreshRoomResponse {
  video_room_url: string
  was_refreshed: boolean
}

// Room is considered stale if older than 30 minutes (Daily rooms expire at 35 minutes)
const ROOM_FRESHNESS_THRESHOLD_MS = 30 * 60 * 1000

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
    const { booking_id }: EnsureFreshRoomRequest = await req.json()

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'Missing booking_id' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    console.log(`[ENSURE-FRESH-ROOM] Processing booking ${booking_id}`)

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get Daily API key from environment
    const dailyApiKey = Deno.env.get('DAILY_API_KEY')
    if (!dailyApiKey) {
      console.error('[ENSURE-FRESH-ROOM] DAILY_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Daily API key not configured' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Fetch booking with room metadata
    const { data: booking, error: fetchError } = await supabaseClient
      .from('bookings')
      .select('id, video_room_url, room_created_at, room_generation')
      .eq('id', booking_id)
      .single()

    if (fetchError || !booking) {
      console.error('[ENSURE-FRESH-ROOM] Booking not found:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    const now = new Date()
    const currentGeneration = booking.room_generation || 0

    // Check if room is fresh
    let needsNewRoom = false
    if (!booking.video_room_url) {
      console.log('[ENSURE-FRESH-ROOM] No room URL exists, need to create')
      needsNewRoom = true
    } else if (!booking.room_created_at) {
      console.log('[ENSURE-FRESH-ROOM] No room_created_at timestamp, assuming stale')
      needsNewRoom = true
    } else {
      const roomAge = now.getTime() - new Date(booking.room_created_at).getTime()
      if (roomAge > ROOM_FRESHNESS_THRESHOLD_MS) {
        console.log(`[ENSURE-FRESH-ROOM] Room is stale (${Math.floor(roomAge / 1000)}s old), need to create`)
        needsNewRoom = true
      } else {
        console.log(`[ENSURE-FRESH-ROOM] Room is fresh (${Math.floor(roomAge / 1000)}s old), reusing`)
      }
    }

    // If room is fresh, return it
    if (!needsNewRoom) {
      return new Response(
        JSON.stringify({
          video_room_url: booking.video_room_url,
          was_refreshed: false,
        } as EnsureFreshRoomResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Create new Daily room
    console.log('[ENSURE-FRESH-ROOM] Creating new Daily room...')
    const expiryTime = Math.floor(Date.now() / 1000) + (35 * 60) // 35 minutes from now

    const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dailyApiKey}`,
      },
      body: JSON.stringify({
        properties: {
          exp: expiryTime,
          max_participants: 2,
        },
      }),
    })

    if (!dailyResponse.ok) {
      const errorData = await dailyResponse.json()
      console.error('[ENSURE-FRESH-ROOM] Daily.co API error:', errorData)
      return new Response(
        JSON.stringify({ error: 'Failed to create Daily room', details: errorData }),
        {
          status: dailyResponse.status,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    const roomData = await dailyResponse.json()
    const newRoomUrl = roomData.url

    console.log(`[ENSURE-FRESH-ROOM] Created Daily room: ${newRoomUrl}`)

    // Update booking with new room using optimistic locking
    // This prevents race conditions when multiple concurrent requests try to update
    const { data: updatedBooking, error: updateError } = await supabaseClient
      .from('bookings')
      .update({
        video_room_url: newRoomUrl,
        room_created_at: now.toISOString(),
        room_generation: currentGeneration + 1,
      })
      .eq('id', booking_id)
      .eq('room_generation', currentGeneration) // Optimistic lock: only update if generation matches
      .select('video_room_url')
      .single()

    if (updateError) {
      // Optimistic lock conflict: another request won the race
      // Re-fetch the booking to get the winner's room URL
      console.log('[ENSURE-FRESH-ROOM] Optimistic lock conflict, re-fetching booking')
      const { data: refetchedBooking, error: refetchError } = await supabaseClient
        .from('bookings')
        .select('video_room_url')
        .eq('id', booking_id)
        .single()

      if (refetchError || !refetchedBooking?.video_room_url) {
        console.error('[ENSURE-FRESH-ROOM] Failed to re-fetch after conflict:', refetchError)
        return new Response(
          JSON.stringify({ error: 'Failed to ensure fresh room' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        )
      }

      console.log(`[ENSURE-FRESH-ROOM] Using room from concurrent request: ${refetchedBooking.video_room_url}`)
      return new Response(
        JSON.stringify({
          video_room_url: refetchedBooking.video_room_url,
          was_refreshed: true,
        } as EnsureFreshRoomResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Successfully updated with new room
    console.log(`[ENSURE-FRESH-ROOM] Successfully updated booking with new room`)
    return new Response(
      JSON.stringify({
        video_room_url: newRoomUrl,
        was_refreshed: true,
      } as EnsureFreshRoomResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error) {
    console.error('[ENSURE-FRESH-ROOM] Error:', error)
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
