// Supabase Edge Function: Send Booking Emails
// Sends transactional emails to giver and seeker based on booking events
// Events: "created" | "pending_approval" | "confirmed" | "cancelled"

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail } from '../_shared/email.ts'

type BookingEvent = 'created' | 'pending_approval' | 'confirmed' | 'cancelled'

interface BookingEmailRequest {
  booking_id: string
  event: BookingEvent
}

interface BookingData {
  id: string
  scheduled_time: string
  amount_cents: number
  status: string
  giver_id: string
  seeker_id: string
  duration_minutes: number
}

interface ProfileData {
  id: string
  name: string
  email: string
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
    const { booking_id, event }: BookingEmailRequest = await req.json()

    // Validate request
    if (!booking_id || !event) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: booking_id and event' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    console.log(`[BOOKING EMAILS] Processing ${event} for booking ${booking_id}`)

    // Initialize Supabase client with service role key for full access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select('id, scheduled_time, amount_cents, status, giver_id, seeker_id, duration_minutes')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      console.error('[BOOKING EMAILS] Failed to fetch booking:', bookingError)
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Fetch giver profile
    const { data: giver, error: giverError } = await supabaseClient
      .from('profiles')
      .select('id, name, email')
      .eq('id', booking.giver_id)
      .single()

    // Fetch seeker profile
    const { data: seeker, error: seekerError } = await supabaseClient
      .from('profiles')
      .select('id, name, email')
      .eq('id', booking.seeker_id)
      .single()

    if (giverError || !giver || seekerError || !seeker) {
      console.error('[BOOKING EMAILS] Failed to fetch profiles:', { giverError, seekerError })
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profiles' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      )
    }

    // Format booking details
    const scheduledDate = new Date(booking.scheduled_time)
    const formattedDate = scheduledDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const amountDollars = (booking.amount_cents / 100).toFixed(2)
    const appUrl = Deno.env.get('APP_URL') || 'https://myca.com'
    const bookingsUrl = `${appUrl}/#/sessions`

    // Generate email content based on event
    const { giverSubject, giverHtml, seekerSubject, seekerHtml } = generateEmailContent(
      event,
      {
        giverName: giver.name || 'there',
        seekerName: seeker.name || 'there',
        formattedDate,
        formattedTime,
        amountDollars,
        duration: booking.duration_minutes,
        bookingsUrl,
      }
    )

    // Send emails to both parties
    const results = {
      giverEmail: { success: false, error: '' },
      seekerEmail: { success: false, error: '' },
    }

    // Send to giver
    const giverResult = await sendEmail(giver.email, giverSubject, giverHtml)
    results.giverEmail = giverResult

    // Send to seeker
    const seekerResult = await sendEmail(seeker.email, seekerSubject, seekerHtml)
    results.seekerEmail = seekerResult

    // Log results
    if (giverResult.testModeBlocked) {
      console.log('[BOOKING EMAILS] Giver email blocked by Resend test-mode')
    }
    if (seekerResult.testModeBlocked) {
      console.log('[BOOKING EMAILS] Seeker email blocked by Resend test-mode')
    }
    console.log('[BOOKING EMAILS] Results:', results)

    // Return 200 even if one recipient fails, but include errors in response
    const allSuccessful = giverResult.success && seekerResult.success
    const errors = []
    if (!giverResult.success) errors.push(`Giver: ${giverResult.error}`)
    if (!seekerResult.success) errors.push(`Seeker: ${seekerResult.error}`)

    return new Response(
      JSON.stringify({
        success: allSuccessful,
        partial: !allSuccessful && (giverResult.success || seekerResult.success),
        results,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    )
  } catch (error) {
    console.error('[BOOKING EMAILS] Error:', error)
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

interface EmailContentParams {
  giverName: string
  seekerName: string
  formattedDate: string
  formattedTime: string
  amountDollars: string
  duration: number
  bookingsUrl: string
}

function generateEmailContent(
  event: BookingEvent,
  params: EmailContentParams
): {
  giverSubject: string
  giverHtml: string
  seekerSubject: string
  seekerHtml: string
} {
  const { giverName, seekerName, formattedDate, formattedTime, amountDollars, duration, bookingsUrl } = params

  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
      .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
      .booking-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
      .detail { margin: 10px 0; padding: 10px; background: #f3f4f6; border-radius: 5px; }
      .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
    </style>
  `

  switch (event) {
    case 'created':
    case 'pending_approval':
      return {
        giverSubject: `New booking request from ${seekerName}`,
        giverHtml: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>New Booking Request</h1>
            </div>
            <div class="content">
              <p>Hi ${giverName},</p>
              <p><strong>${seekerName}</strong> has requested to book a session with you!</p>

              <div class="booking-card">
                <div class="detail"><strong>📅 Date:</strong> ${formattedDate}</div>
                <div class="detail"><strong>🕐 Time:</strong> ${formattedTime}</div>
                <div class="detail"><strong>⏱️ Duration:</strong> ${duration} minutes</div>
                <div class="detail"><strong>💰 Amount:</strong> $${amountDollars}</div>
                <div class="detail"><strong>📊 Status:</strong> ${event === 'pending_approval' ? 'Pending Your Approval' : 'Payment Pending'}</div>
              </div>

              ${event === 'pending_approval' ? '<p><strong>Action required:</strong> Please review and approve this booking request.</p>' : '<p>The booking will be confirmed once payment is completed.</p>'}

              <a href="${bookingsUrl}" class="button">View Booking</a>

              <div class="footer">
                <p>Myca - Meaningful Connections</p>
              </div>
            </div>
          </div>
        `,
        seekerSubject: `Booking request sent to ${giverName}`,
        seekerHtml: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>Booking Request Sent</h1>
            </div>
            <div class="content">
              <p>Hi ${seekerName},</p>
              <p>Your booking request with <strong>${giverName}</strong> has been sent successfully!</p>

              <div class="booking-card">
                <div class="detail"><strong>📅 Date:</strong> ${formattedDate}</div>
                <div class="detail"><strong>🕐 Time:</strong> ${formattedTime}</div>
                <div class="detail"><strong>⏱️ Duration:</strong> ${duration} minutes</div>
                <div class="detail"><strong>💰 Amount:</strong> $${amountDollars}</div>
                <div class="detail"><strong>📊 Status:</strong> ${event === 'pending_approval' ? 'Awaiting approval' : 'Payment pending'}</div>
              </div>

              ${event === 'pending_approval' ? '<p>Your booking is awaiting approval from the host. We\'ll notify you once they respond.</p>' : '<p>Your booking will be confirmed once payment is completed.</p>'}

              <a href="${bookingsUrl}" class="button">View Booking</a>

              <div class="footer">
                <p>Myca - Meaningful Connections</p>
              </div>
            </div>
          </div>
        `,
      }

    case 'confirmed':
      return {
        giverSubject: `Booking confirmed with ${seekerName}`,
        giverHtml: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>✓ Booking Confirmed</h1>
            </div>
            <div class="content">
              <p>Hi ${giverName},</p>
              <p>Great news! Your session with <strong>${seekerName}</strong> is confirmed.</p>

              <div class="booking-card">
                <div class="detail"><strong>📅 Date:</strong> ${formattedDate}</div>
                <div class="detail"><strong>🕐 Time:</strong> ${formattedTime}</div>
                <div class="detail"><strong>⏱️ Duration:</strong> ${duration} minutes</div>
                <div class="detail"><strong>💰 Amount:</strong> $${amountDollars}</div>
                <div class="detail"><strong>📊 Status:</strong> Confirmed ✓</div>
              </div>

              <p>The session link will be available 10 minutes before the scheduled time.</p>

              <a href="${bookingsUrl}" class="button">View Booking</a>

              <div class="footer">
                <p>Myca - Meaningful Connections</p>
              </div>
            </div>
          </div>
        `,
        seekerSubject: `Booking confirmed with ${giverName}`,
        seekerHtml: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>✓ Booking Confirmed</h1>
            </div>
            <div class="content">
              <p>Hi ${seekerName},</p>
              <p>Wonderful! Your session with <strong>${giverName}</strong> is confirmed.</p>

              <div class="booking-card">
                <div class="detail"><strong>📅 Date:</strong> ${formattedDate}</div>
                <div class="detail"><strong>🕐 Time:</strong> ${formattedTime}</div>
                <div class="detail"><strong>⏱️ Duration:</strong> ${duration} minutes</div>
                <div class="detail"><strong>💰 Amount:</strong> $${amountDollars}</div>
                <div class="detail"><strong>📊 Status:</strong> Confirmed ✓</div>
              </div>

              <p>The session link will be available 10 minutes before the scheduled time.</p>

              <a href="${bookingsUrl}" class="button">View Booking</a>

              <div class="footer">
                <p>Myca - Meaningful Connections</p>
              </div>
            </div>
          </div>
        `,
      }

    case 'cancelled':
      return {
        giverSubject: `Booking cancelled with ${seekerName}`,
        giverHtml: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>Booking Cancelled</h1>
            </div>
            <div class="content">
              <p>Hi ${giverName},</p>
              <p>The booking with <strong>${seekerName}</strong> has been cancelled.</p>

              <div class="booking-card">
                <div class="detail"><strong>📅 Date:</strong> ${formattedDate}</div>
                <div class="detail"><strong>🕐 Time:</strong> ${formattedTime}</div>
                <div class="detail"><strong>⏱️ Duration:</strong> ${duration} minutes</div>
                <div class="detail"><strong>💰 Amount:</strong> $${amountDollars}</div>
                <div class="detail"><strong>📊 Status:</strong> Cancelled</div>
              </div>

              <a href="${bookingsUrl}" class="button">View Bookings</a>

              <div class="footer">
                <p>Myca - Meaningful Connections</p>
              </div>
            </div>
          </div>
        `,
        seekerSubject: `Booking cancelled with ${giverName}`,
        seekerHtml: `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <h1>Booking Cancelled</h1>
            </div>
            <div class="content">
              <p>Hi ${seekerName},</p>
              <p>Your booking with <strong>${giverName}</strong> has been cancelled.</p>

              <div class="booking-card">
                <div class="detail"><strong>📅 Date:</strong> ${formattedDate}</div>
                <div class="detail"><strong>🕐 Time:</strong> ${formattedTime}</div>
                <div class="detail"><strong>⏱️ Duration:</strong> ${duration} minutes</div>
                <div class="detail"><strong>💰 Amount:</strong> $${amountDollars}</div>
                <div class="detail"><strong>📊 Status:</strong> Cancelled</div>
              </div>

              <p>If you were charged, a refund will be processed according to the cancellation policy.</p>

              <a href="${bookingsUrl}" class="button">View Bookings</a>

              <div class="footer">
                <p>Myca - Meaningful Connections</p>
              </div>
            </div>
          </div>
        `,
      }
  }
}
