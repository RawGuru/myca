import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const colors = {
  bgPrimary: '#000000',
  bgSecondary: '#0a0a0a',
  bgCard: '#0f0f0f',
  textPrimary: '#ffffff',
  textSecondary: '#999999',
  textMuted: '#666666',
  accent: '#b89d5f',
  accentSoft: 'rgba(184, 157, 95, 0.1)',
  border: '#1a1a1a',
  success: '#b89d5f',
  error: '#d9534f',
}

interface ReceiverInitiatedExtensionProps {
  bookingId: string
  userRole: 'receiver' | 'giver'
  userId: string
  giverId: string
  receiverId: string
  receiverName: string
  amountCents: number
  sessionTimeRemaining: number
  onExtensionGranted: () => void
  onExtensionDeclined: () => void
}

interface ExtensionRequest {
  id: string
  booking_id: string
  requested_by: string
  requested_at: string
  giver_response: 'accepted' | 'declined' | 'timeout' | null
  status: 'pending' | 'accepted' | 'declined' | 'timeout' | 'payment_failed'
  amount_cents: number
}

export function ReceiverInitiatedExtension({
  bookingId,
  userRole,
  userId: _userId, // Not used in current implementation
  giverId,
  receiverId,
  receiverName,
  amountCents,
  sessionTimeRemaining,
  onExtensionGranted,
  onExtensionDeclined
}: ReceiverInitiatedExtensionProps) {
  const [showReceiverPrompt, setShowReceiverPrompt] = useState(false)
  const [showGiverPrompt, setShowGiverPrompt] = useState(false)
  const [extensionRequest, setExtensionRequest] = useState<ExtensionRequest | null>(null)
  const [_checkingAvailability, setCheckingAvailability] = useState(false)
  const [_giverAvailable, setGiverAvailable] = useState(false)
  const [responseTimeRemaining, setResponseTimeRemaining] = useState(30)
  const [processing, setProcessing] = useState(false)

  // Check giver availability at 3 minutes remaining (receiver only)
  useEffect(() => {
    if (userRole !== 'receiver') return
    if (sessionTimeRemaining !== 180) return // 3 minutes = 180 seconds

    checkGiverAvailability()
  }, [sessionTimeRemaining, userRole])

  // Subscribe to extension requests (giver only)
  useEffect(() => {
    if (userRole !== 'giver') return

    const channel = supabase
      .channel(`extension:${bookingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'extensions',
        filter: `booking_id=eq.${bookingId}`
      }, (payload) => {
        const request = payload.new as ExtensionRequest
        if (request.status === 'pending') {
          setExtensionRequest(request)
          setShowGiverPrompt(true)
          setResponseTimeRemaining(30)
        }
      })
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [bookingId, userRole])

  // Countdown timer for giver response (30 seconds)
  useEffect(() => {
    if (!showGiverPrompt) return

    const timer = setInterval(() => {
      setResponseTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showGiverPrompt])

  const checkGiverAvailability = async () => {
    setCheckingAvailability(true)

    try {
      // Get current session end time
      const { data: booking } = await supabase
        .from('bookings')
        .select('scheduled_time, session_blocks')
        .eq('id', bookingId)
        .single()

      if (!booking) {
        setCheckingAvailability(false)
        return
      }

      const sessionEnd = new Date(booking.scheduled_time)
      sessionEnd.setMinutes(sessionEnd.getMinutes() + (booking.session_blocks * 25))

      // Check if giver has availability in the next 30 minutes after current session
      const extensionStart = new Date(sessionEnd)
      const extensionEnd = new Date(sessionEnd)
      extensionEnd.setMinutes(extensionEnd.getMinutes() + 30)

      const { data: availability } = await supabase
        .from('giver_availability')
        .select('*')
        .eq('giver_id', giverId)
        .gte('start_time', extensionStart.toISOString())
        .lte('start_time', extensionEnd.toISOString())
        .eq('is_available', true)
        .limit(1)

      const available = !!(availability && availability.length > 0)
      setGiverAvailable(available)

      // Show prompt to receiver if giver is available
      if (available) {
        setShowReceiverPrompt(true)
      }
    } catch (error) {
      console.error('Error checking giver availability:', error)
    } finally {
      setCheckingAvailability(false)
    }
  }

  const handleReceiverRequest = async () => {
    setProcessing(true)

    try {
      // Create extension request
      const { data: extension, error } = await supabase
        .from('extensions')
        .insert({
          booking_id: bookingId,
          requested_by: receiverId,
          requested_at: new Date().toISOString(),
          amount_cents: amountCents,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error

      setExtensionRequest(extension)

      // Record milestone
      await supabase.from('session_milestones').insert({
        booking_id: bookingId,
        event_type: 'extension_requested',
        user_id: receiverId,
        metadata: { extension_id: extension.id }
      })

      setShowReceiverPrompt(false)
      // Receiver now waits for giver response
    } catch (error) {
      console.error('Error creating extension request:', error)
      alert('Failed to request extension')
    } finally {
      setProcessing(false)
    }
  }

  const handleReceiverDecline = () => {
    setShowReceiverPrompt(false)
    onExtensionDeclined()
  }

  const handleGiverAccept = async () => {
    if (!extensionRequest) return
    setProcessing(true)

    try {
      // Update extension request
      const { error } = await supabase
        .from('extensions')
        .update({
          giver_response: 'accepted',
          giver_responded_at: new Date().toISOString(),
          status: 'accepted'
        })
        .eq('id', extensionRequest.id)

      if (error) throw error

      // Record milestone
      await supabase.from('session_milestones').insert({
        booking_id: bookingId,
        event_type: 'extension_granted',
        user_id: giverId,
        metadata: { extension_id: extensionRequest.id }
      })

      // Update session_states
      await supabase
        .from('session_states')
        .update({
          extension_pending: false,
          extension_id: extensionRequest.id
        })
        .eq('booking_id', bookingId)

      setShowGiverPrompt(false)
      onExtensionGranted()
    } catch (error) {
      console.error('Error accepting extension:', error)
      alert('Failed to accept extension')
    } finally {
      setProcessing(false)
    }
  }

  const handleGiverDecline = async () => {
    if (!extensionRequest) return
    setProcessing(true)

    try {
      // Update extension request
      const { error } = await supabase
        .from('extensions')
        .update({
          giver_response: 'declined',
          giver_responded_at: new Date().toISOString(),
          status: 'declined'
        })
        .eq('id', extensionRequest.id)

      if (error) throw error

      // Record milestone
      await supabase.from('session_milestones').insert({
        booking_id: bookingId,
        event_type: 'extension_declined',
        user_id: giverId,
        metadata: { extension_id: extensionRequest.id }
      })

      setShowGiverPrompt(false)
      onExtensionDeclined()
    } catch (error) {
      console.error('Error declining extension:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleTimeout = async () => {
    if (!extensionRequest) return

    try {
      // Update extension request as timeout
      await supabase
        .from('extensions')
        .update({
          giver_response: 'timeout',
          status: 'timeout'
        })
        .eq('id', extensionRequest.id)

      // Record milestone
      await supabase.from('session_milestones').insert({
        booking_id: bookingId,
        event_type: 'extension_declined',
        user_id: giverId,
        metadata: {
          extension_id: extensionRequest.id,
          reason: 'timeout'
        }
      })

      setShowGiverPrompt(false)
      onExtensionDeclined()
    } catch (error) {
      console.error('Error handling timeout:', error)
    }
  }

  // Don't render if not showing prompts
  if (!showReceiverPrompt && !showGiverPrompt) return null

  // Receiver prompt
  if (showReceiverPrompt && userRole === 'receiver') {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 10, 0.95)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: colors.bgCard,
          border: `2px solid ${colors.accent}`,
          borderRadius: '3px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⏰</div>

          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '15px',
            color: colors.textPrimary
          }}>
            Continue for 30 more minutes?
          </h2>

          <p style={{
            fontSize: '1rem',
            color: colors.textSecondary,
            marginBottom: '10px',
            lineHeight: 1.6
          }}>
            Your giver has availability to continue.
          </p>

          <p style={{
            fontSize: '1.1rem',
            color: colors.accent,
            marginBottom: '30px',
            fontWeight: 600
          }}>
            ${(amountCents / 100).toFixed(2)} + platform fee
          </p>

          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={handleReceiverRequest}
              disabled={processing}
              style={{
                flex: 1,
                padding: '16px',
                background: colors.success,
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.6 : 1
              }}
            >
              {processing ? 'Requesting...' : 'Yes, continue'}
            </button>
            <button
              onClick={handleReceiverDecline}
              disabled={processing}
              style={{
                flex: 1,
                padding: '16px',
                background: 'transparent',
                color: colors.textPrimary,
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.6 : 1
              }}
            >
              No, end session
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Giver prompt
  if (showGiverPrompt && userRole === 'giver') {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 10, 0.95)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: colors.bgCard,
          border: `2px solid ${colors.accent}`,
          borderRadius: '3px',
          padding: '40px',
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⏰</div>

          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '15px',
            color: colors.textPrimary
          }}>
            {receiverName} wants to continue
          </h2>

          <p style={{
            fontSize: '1rem',
            color: colors.textSecondary,
            marginBottom: '10px',
            lineHeight: 1.6
          }}>
            Continue for 30 more minutes?
          </p>

          <p style={{
            fontSize: '1.1rem',
            color: colors.accent,
            marginBottom: '20px',
            fontWeight: 600
          }}>
            ${(amountCents / 100).toFixed(2)}
          </p>

          <p style={{
            fontSize: '0.9rem',
            color: colors.textMuted,
            marginBottom: '30px',
            fontFamily: 'monospace'
          }}>
            {responseTimeRemaining}s remaining
          </p>

          <div style={{ display: 'flex', gap: '15px' }}>
            <button
              onClick={handleGiverAccept}
              disabled={processing}
              style={{
                flex: 1,
                padding: '16px',
                background: colors.success,
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.6 : 1
              }}
            >
              {processing ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={handleGiverDecline}
              disabled={processing}
              style={{
                flex: 1,
                padding: '16px',
                background: 'rgba(201, 107, 107, 0.9)',
                color: '#fff',
                border: 'none',
                borderRadius: '3px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.6 : 1
              }}
            >
              {processing ? 'Declining...' : 'Decline'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
