import { useEffect, useRef, useState, useCallback } from 'react'
import type { DailyCall } from '@daily-co/daily-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import {
  PhaseIndicator,
  TransmissionPhase,
  ReflectionPhase,
  ValidationPhase,
  EmergencePhase,
  SessionEndedSummary
} from './components/session/PhaseComponents'

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SessionPhase = 'transmission' | 'reflection' | 'validation' | 'emergence' | 'ended'
export type UserRole = 'receiver' | 'giver'
export type EmergenceVerb = 'explore' | 'strategize' | 'reflect_deeper' | 'challenge' | 'synthesize' | 'just_talk'

export interface SessionState {
  id: string
  booking_id: string
  current_phase: SessionPhase
  validation_attempts: number
  emergence_verb: EmergenceVerb | null
  extension_pending: boolean
  extension_id: string | null
  started_at: string
  transmission_started_at: string | null
  reflection_started_at: string | null
  validation_started_at: string | null
  emergence_started_at: string | null
  ended_at: string | null
  end_reason: 'completed' | 'time_expired' | 'participant_left' | 'error' | null
  updated_at: string
  updated_by: string | null
  created_at: string
}

export interface Booking {
  id: string
  seeker_id: string
  giver_id: string
  scheduled_time: string
  blocks_booked: number
  amount_cents: number
  status: string
  video_room_url: string | null
}

interface SessionStateMachineProps {
  booking: Booking
  dailyCall: DailyCall | null
  userRole: UserRole
  userId: string
  sessionTimeRemaining: number
  onSessionEnd: () => void
  onRequestExtension?: () => void
}

// ============================================
// SUPABASE REALTIME HOOK
// ============================================

function useSessionRealtime(bookingId: string, onStateUpdate: (state: SessionState) => void) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const reconnectAttemptsRef = useRef(0)
  const MAX_RECONNECT_ATTEMPTS = 10
  const BASE_RETRY_DELAY = 2000

  useEffect(() => {
    if (!bookingId) return

    const channelName = `session:${bookingId}`

    const setupChannel = () => {
      // Clean up existing channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'session_states',
            filter: `booking_id=eq.${bookingId}`
          },
          (payload) => {
            console.log('[Realtime] Session state updated:', payload)
            const newState = payload.new as SessionState
            onStateUpdate(newState)
            reconnectAttemptsRef.current = 0
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Subscription status:', status)

          if (status === 'SUBSCRIBED') {
            setConnectionStatus('connected')
            reconnectAttemptsRef.current = 0
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus('disconnected')
            handleReconnect()
          } else if (status === 'CLOSED') {
            setConnectionStatus('disconnected')
          }
        })

      channelRef.current = channel
    }

    const handleReconnect = () => {
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[Realtime] Max reconnection attempts reached')
        alert('Lost connection to session. Please refresh the page.')
        return
      }

      reconnectAttemptsRef.current++
      const delay = Math.min(
        BASE_RETRY_DELAY * Math.pow(1.5, reconnectAttemptsRef.current - 1),
        30000
      )

      console.log(`[Realtime] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`)

      setTimeout(() => {
        setupChannel()
      }, delay)
    }

    setupChannel()

    // Handle network events
    const handleOnline = () => {
      console.log('[Realtime] Network online, reconnecting...')
      setupChannel()
    }

    const handleOffline = () => {
      console.log('[Realtime] Network offline')
      setConnectionStatus('disconnected')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [bookingId, onStateUpdate])

  return { connectionStatus }
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SessionStateMachine({
  booking,
  dailyCall,
  userRole,
  userId,
  sessionTimeRemaining,
  onSessionEnd: _onSessionEnd, // Will be used when session ends (prefixed with _ to avoid unused warning)
  onRequestExtension
}: SessionStateMachineProps) {
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)

  // Realtime subscription
  const { connectionStatus } = useSessionRealtime(
    booking.id,
    useCallback((newState: SessionState) => {
      setSessionState(newState)
    }, [])
  )

  // Initialize or fetch session state on mount
  useEffect(() => {
    fetchOrCreateSessionState()
  }, [booking.id])

  const fetchOrCreateSessionState = async () => {
    try {
      // Try to fetch existing session state
      const { data, error } = await supabase
        .from('session_states')
        .select('*')
        .eq('booking_id', booking.id)
        .maybeSingle()

      if (error) throw error

      if (data) {
        // Session state exists
        setSessionState(data as SessionState)
      } else {
        // Create initial session state (first party to join)
        const { data: newState, error: createError } = await supabase
          .from('session_states')
          .insert({
            booking_id: booking.id,
            current_phase: 'transmission',
            validation_attempts: 0,
            transmission_started_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
            updated_by: userId
          })
          .select()
          .single()

        if (createError) throw createError

        setSessionState(newState as SessionState)

        // Record milestone
        await recordMilestone('phase_transition', {
          from_phase: null,
          to_phase: 'transmission'
        })
      }
    } catch (err) {
      console.error('[SessionStateMachine] Error fetching/creating session state:', err)
      alert('Failed to initialize session. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  // Record milestone to database
  const recordMilestone = async (eventType: string, metadata?: any) => {
    try {
      await supabase.from('session_milestones').insert({
        booking_id: booking.id,
        event_type: eventType,
        user_id: userId,
        metadata: metadata || null
      })
      console.log(`[Milestone] Recorded: ${eventType}`, metadata)
    } catch (err) {
      console.error('[Milestone] Error recording:', err)
    }
  }

  // Update phase with optimistic UI
  const updatePhase = async (newPhase: SessionPhase, initiator: 'user' | 'system' = 'user') => {
    if (!sessionState) return

    const previousPhase = sessionState.current_phase
    const timestampField = `${newPhase}_started_at` as keyof SessionState

    if (initiator === 'user') {
      // Optimistic update - instant UI
      setSessionState(prev => prev ? {
        ...prev,
        current_phase: newPhase,
        [timestampField]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: userId
      } : null)

      try {
        const { error } = await supabase
          .from('session_states')
          .update({
            current_phase: newPhase,
            [timestampField]: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: userId
          })
          .eq('booking_id', booking.id)

        if (error) {
          console.error('[Session] Phase update failed, rolling back:', error)
          // Rollback optimistic update
          await fetchOrCreateSessionState()
          alert('Failed to advance session. Please try again.')
          return
        }

        // Record milestone
        await recordMilestone('phase_transition', {
          from_phase: previousPhase,
          to_phase: newPhase,
          user_role: userRole
        })
      } catch (err) {
        console.error('[Session] Error updating phase:', err)
        await fetchOrCreateSessionState()
      }
    } else {
      // System-initiated - wait for DB
      try {
        const { error } = await supabase
          .from('session_states')
          .update({
            current_phase: newPhase,
            [timestampField]: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('booking_id', booking.id)

        if (!error) {
          setSessionState(prev => prev ? {
            ...prev,
            current_phase: newPhase,
            [timestampField]: new Date().toISOString(),
            updated_at: new Date().toISOString()
          } : null)

          await recordMilestone('phase_transition', {
            from_phase: previousPhase,
            to_phase: newPhase,
            triggered_by: 'system'
          })
        }
      } catch (err) {
        console.error('[Session] Error updating phase (system):', err)
      }
    }
  }

  // Handle receiver actions
  const handleReceiverDoneTransmission = async () => {
    console.log('[Receiver] Done with transmission, advancing to reflection')
    await updatePhase('reflection', 'user')
  }

  const handleReceiverValidationYes = async (verb: EmergenceVerb) => {
    console.log('[Receiver] Validation YES, advancing to emergence with verb:', verb)

    if (!sessionState) return

    // Update phase and verb
    setSessionState(prev => prev ? {
      ...prev,
      current_phase: 'emergence',
      emergence_verb: verb,
      emergence_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userId
    } : null)

    try {
      const { error } = await supabase
        .from('session_states')
        .update({
          current_phase: 'emergence',
          emergence_verb: verb,
          emergence_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('booking_id', booking.id)

      if (error) {
        console.error('[Session] Failed to advance to emergence:', error)
        await fetchOrCreateSessionState()
        alert('Failed to advance session. Please try again.')
        return
      }

      // Record milestones
      await recordMilestone('validation_succeeded', {
        validation_attempts: sessionState.validation_attempts,
        emergence_verb: verb
      })
      await recordMilestone('phase_transition', {
        from_phase: 'validation',
        to_phase: 'emergence',
        emergence_verb: verb
      })

      // Update giver metrics (validation succeeded)
      await updateGiverMetrics(true)
    } catch (err) {
      console.error('[Session] Error advancing to emergence:', err)
      await fetchOrCreateSessionState()
    }
  }

  const handleReceiverValidationNo = async () => {
    console.log('[Receiver] Validation NO, resetting to transmission')

    if (!sessionState) return

    const newAttempts = sessionState.validation_attempts + 1

    // Optimistic update
    setSessionState(prev => prev ? {
      ...prev,
      current_phase: 'transmission',
      validation_attempts: newAttempts,
      transmission_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userId
    } : null)

    try {
      const { error } = await supabase
        .from('session_states')
        .update({
          current_phase: 'transmission',
          validation_attempts: newAttempts,
          transmission_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('booking_id', booking.id)

      if (error) {
        console.error('[Session] Failed to reset to transmission:', error)
        await fetchOrCreateSessionState()
        return
      }

      // Record milestones
      await recordMilestone('validation_failed', {
        validation_attempts: newAttempts
      })
      await recordMilestone('phase_transition', {
        from_phase: 'validation',
        to_phase: 'transmission',
        reason: 'validation_failed',
        attempt_number: newAttempts
      })

      // Update giver metrics (validation failed)
      await updateGiverMetrics(false)
    } catch (err) {
      console.error('[Session] Error resetting to transmission:', err)
      await fetchOrCreateSessionState()
    }
  }

  // Handle giver actions
  const handleGiverDoneReflection = async () => {
    console.log('[Giver] Done with reflection, advancing to validation')
    await updatePhase('validation', 'user')
  }

  // Update giver metrics
  const updateGiverMetrics = async (accepted: boolean) => {
    // Note: Metrics are updated automatically by trigger function on feedback submission
    // This is just for logging
    console.log(`[Metrics] Validation result for giver: ${accepted ? 'accepted' : 'rejected'}`)
  }

  // Mic control based on phase and role
  useEffect(() => {
    if (!dailyCall || !sessionState) return

    const micPermissions: Record<SessionPhase, Record<UserRole, boolean>> = {
      transmission: { receiver: true, giver: false },
      reflection: { receiver: false, giver: true },
      validation: { receiver: false, giver: false }, // Both muted during validation UI
      emergence: { receiver: true, giver: true },
      ended: { receiver: false, giver: false }
    }

    const shouldMicBeOn = micPermissions[sessionState.current_phase][userRole]

    try {
      dailyCall.setLocalAudio(shouldMicBeOn)
      console.log(`[Mic] Set to ${shouldMicBeOn ? 'ON' : 'OFF'} for ${userRole} in ${sessionState.current_phase}`)
    } catch (err) {
      console.error('[Mic] Error setting audio state:', err)
    }
  }, [dailyCall, sessionState?.current_phase, userRole])

  // Monitor for manual mic toggles and override
  useEffect(() => {
    if (!dailyCall || !sessionState) return

    const handleParticipantUpdated = (event: any) => {
      if (event.participant.local) {
        const micPermissions: Record<SessionPhase, Record<UserRole, boolean>> = {
          transmission: { receiver: true, giver: false },
          reflection: { receiver: false, giver: true },
          validation: { receiver: false, giver: false },
          emergence: { receiver: true, giver: true },
          ended: { receiver: false, giver: false }
        }

        const shouldMicBeOn = micPermissions[sessionState.current_phase][userRole]
        const actualMicState = event.participant.tracks.audio.state

        if ((actualMicState === 'playable') !== shouldMicBeOn) {
          console.warn('[Mic] User manually toggled mic, re-enforcing protocol state')
          dailyCall.setLocalAudio(shouldMicBeOn)
        }
      }
    }

    dailyCall.on('participant-updated', handleParticipantUpdated)

    return () => {
      dailyCall.off('participant-updated', handleParticipantUpdated)
    }
  }, [dailyCall, sessionState?.current_phase, userRole])

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        <p>Loading session...</p>
      </div>
    )
  }

  if (!sessionState) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
        <p>Failed to load session. Please refresh the page.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Connection status banner */}
      {connectionStatus === 'disconnected' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#f59e0b',
          color: 'white',
          padding: '10px',
          textAlign: 'center',
          zIndex: 1000
        }}>
          Reconnecting to session...
        </div>
      )}

      {/* Temporary placeholder - phase UI components will go here */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Phase Indicator - always visible */}
        <PhaseIndicator currentPhase={sessionState.current_phase} />

        {/* Phase-specific UI */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {sessionState.current_phase === 'transmission' && (
            <TransmissionPhase
              userRole={userRole}
              onDone={handleReceiverDoneTransmission}
            />
          )}

          {sessionState.current_phase === 'reflection' && (
            <ReflectionPhase
              userRole={userRole}
              onDone={handleGiverDoneReflection}
            />
          )}

          {sessionState.current_phase === 'validation' && (
            <ValidationPhase
              userRole={userRole}
              validationAttempts={sessionState.validation_attempts}
              onYes={handleReceiverValidationYes}
              onNo={handleReceiverValidationNo}
            />
          )}

          {sessionState.current_phase === 'emergence' && (
            <EmergencePhase
              userRole={userRole}
              emergenceVerb={sessionState.emergence_verb || 'explore'}
              sessionTimeRemaining={sessionTimeRemaining}
              onRequestExtension={onRequestExtension}
            />
          )}

          {sessionState.current_phase === 'ended' && (
            <SessionEndedSummary
              endReason={sessionState.end_reason || 'completed'}
            />
          )}
        </div>
      </div>
    </div>
  )
}
