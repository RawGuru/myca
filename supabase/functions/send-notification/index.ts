// Placeholder email notification endpoint
// Infrastructure setup only - actual email sending to be implemented later

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

type NotificationType = 'booking_confirmed' | 'session_reminder' | 'cancellation'

interface NotificationRequest {
  type: NotificationType
  booking_id: string
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
    const { type, booking_id }: NotificationRequest = await req.json()

    // Validate request
    if (!type || !booking_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Log notification (placeholder - actual email sending will be added later)
    console.log(`[EMAIL NOTIFICATION] Type: ${type}, Booking: ${booking_id}`)

    // TODO: Implement actual email sending
    // - Fetch booking details from database
    // - Get giver and seeker email addresses
    // - Send appropriate email based on notification type
    // - Use Resend, SendGrid, or similar service

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error) {
    console.error('Notification error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  }
})
