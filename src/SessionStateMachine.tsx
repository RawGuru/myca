import { useEffect, useRef, useState, useCallback } from 'react'
import type { DailyCall } from '@daily-co/daily-js'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import {
  PhaseIndicator,
  TransmissionPhase,
  ReflectionPhase,
  ValidationPhase,
  DirectionPhase,
  SessionEndedSummary
} from './components/session/PhaseComponents'

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SessionPhase = 'transmission' | 'reflection' | 'validation' | 'direction' | 'ended'
export type UserRole = 'receiver' | 'giver'
export type DirectionType = 'go_deeper' | 'hear_perspective' | 'think_together' | 'build_next_step' | 'end_cleanly'

export interface SessionState {
  id: string
  booking_id: string
  current_phase: SessionPhase
  validation_attempts: number

  // Direction fields (replacing emergence)
  direction_selected: DirectionType | null
  direction_source: 'pre_consented' | 'custom_request' | null
  direction_request_text: string | null
  direction_giver_response: 'accepted' | 'declined' | null

  // Legacy field for backward compatibility
  emergence_verb: string | null

  extension_pending: boolean
  extension_id: string | null
  started_at: string
  transmission_started_at: string | null
  reflection_started_at: string | null
  validation_started_at: string | null
  direction_started_at: string | null
  ended_at: string | null
  end_reason: 'completed' | 'time_expired' | 'participant_left' | 'error' |
              'receiver_end_complete' | 'giver_safety_exit' | 'technical_failure' |
              'receiver_no_show' | 'giver_no_show' | null
  updated_at: string
  updated_by: string | null
  created_at: string
}

export interface Booking {
  id: string
  seeker_id: string
  giver_id: string
  scheduled_time: string
  duration_minutes: number
  amount_cents: number
  status: 'pending' | 'pending_approval' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  session_intention?: string | null
  stripe_payment_id: string | null
  video_room_url: string | null
  created_at?: string
  giver_joined_at?: string | null
  seeker_credit_earned?: boolean | null
  started_at?: string | null
  ended_at?: string | null
  elapsed_seconds?: number | null
  end_reason?: string | null
  payout_net_cents?: number | null
  refund_gross_cents?: number | null
  payout_status?: string | null
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
            const newState = payload.new as SessionState
            const oldState = payload.old as SessionState
            console.log('[Realtime] Session state updated', {
              old_phase: oldState?.current_phase,
              new_phase: newState.current_phase,
              phase_changed: oldState?.current_phase !== newState.current_phase
            })
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
      console.log('[SessionStateMachine] Realtime state update received')
      setSessionState(newState)
    }, [])
  )

  // Log connection status changes
  useEffect(() => {
    console.log('[SessionStateMachine] Realtime connectionStatus changed to:', connectionStatus)
  }, [connectionStatus])

  // Initialize or fetch session state on mount
  useEffect(() => {
    fetchOrCreateSessionState()
  }, [booking.id])

  // Poll authoritative phase as fallback to realtime (every 3 seconds)
  // This ensures UI syncs even if realtime subscription fails
  useEffect(() => {
    if (!booking.id) return

    const pollAuthoritativePhase = async () => {
      try {
        const { data, error } = await supabase
          .from('session_states')
          .select('*')
          .eq('booking_id', booking.id)
          .maybeSingle()

        if (error) {
          console.error('[Phase Poll] Error:', error)
          return
        }

        if (!data) {
          return // Bootstrap in progress
        }

        // Update local state with authoritative data
        // This ensures non-initiating user sees phase transitions
        if (sessionState?.current_phase !== data.current_phase) {
          console.log('[Phase Poll] Authoritative phase mismatch detected', {
            rendered_phase: sessionState?.current_phase,
            authoritative_phase: data.current_phase,
            local_role: userRole
          })
          setSessionState(data as SessionState)
        }
      } catch (err) {
        console.error('[Phase Poll] Exception:', err)
      }
    }

    // Poll every 3 seconds as fallback to realtime
    const interval = setInterval(pollAuthoritativePhase, 3000)

    return () => clearInterval(interval)
  }, [booking.id, sessionState?.current_phase, userRole])

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
      // Check if error is duplicate key violation (code 23505)
      // This happens when two participants join concurrently and both try to create the row
      if (typeof err === 'object' && err !== null && (err as any).code === '23505') {
        console.log('[SessionStateMachine] Duplicate key detected - recovering by fetching existing row')

        // Retry fetch - the other participant must have created it
        try {
          const { data: existingState, error: retryError } = await supabase
            .from('session_states')
            .select('*')
            .eq('booking_id', booking.id)
            .single()

          if (retryError) throw retryError

          setSessionState(existingState as SessionState)
          console.log('[SessionStateMachine] Successfully recovered from concurrent join race')
          return // Success - exit early
        } catch (retryErr) {
          console.error('[SessionStateMachine] Failed to fetch after duplicate key:', retryErr)
          // Fall through to fatal error handling below
        }
      }

      // Fatal error - log and alert
      console.error('========================================')
      console.error('🚨 SESSION STATE INITIALIZATION ERROR 🚨')
      console.error('[SessionStateMachine] Error fetching/creating session state:', err)
      console.error('[SessionStateMachine] Error type:', err instanceof Error ? err.constructor.name : typeof err)
      console.error('[SessionStateMachine] Error message:', err instanceof Error ? err.message : String(err))
      if (err instanceof Error) {
        console.error('[SessionStateMachine] Error name:', err.name)
        console.error('[SessionStateMachine] Error stack:', err.stack)
      }
      // Log Supabase-specific error fields
      if (typeof err === 'object' && err !== null) {
        console.error('[SessionStateMachine] Error code:', (err as any).code)
        console.error('[SessionStateMachine] Error details:', (err as any).details)
        console.error('[SessionStateMachine] Error hint:', (err as any).hint)
        console.error('[SessionStateMachine] Full error object:', JSON.stringify(err, null, 2))
      }
      console.error('🚨 SESSION STATE INITIALIZATION ERROR 🚨')
      console.error('========================================')
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
      // Optimistic update - instant UI for initiating user
      console.log('[Phase Update] Optimistic local update', {
        from_phase: previousPhase,
        to_phase: newPhase,
        initiator: 'user',
        user_role: userRole
      })

      setSessionState(prev => prev ? {
        ...prev,
        current_phase: newPhase,
        [timestampField]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: userId
      } : null)

      try {
        console.log('[Phase Update] Writing to database', {
          from_phase: previousPhase,
          to_phase: newPhase,
          booking_id: booking.id
        })

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
          console.error('[Phase Update] Database update failed, rolling back:', error)
          // Rollback optimistic update
          await fetchOrCreateSessionState()
          alert('Failed to advance session. Please try again.')
          return
        }

        console.log('[Phase Update] Database update successful, other user will receive via realtime or polling')

        // Record milestone
        await recordMilestone('phase_transition', {
          from_phase: previousPhase,
          to_phase: newPhase,
          user_role: userRole
        })
      } catch (err) {
        console.error('[Phase Update] Exception:', err)
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
    console.log('[Receiver] Done with transmission, advancing to reflection', {
      current_phase: sessionState?.current_phase,
      target_phase: 'reflection',
      user_role: userRole,
      booking_id: booking.id
    })
    await updatePhase('reflection', 'user')
  }

  const handleReceiverValidationYes = async (
    direction: DirectionType,
    source: 'pre_consented' | 'custom_request',
    customText?: string
  ) => {
    console.log('[Receiver] Validation YES, advancing to direction with:', direction, source)

    if (!sessionState) return

    const updateData: any = {
      current_phase: 'direction',
      direction_selected: direction,
      direction_source: source,
      direction_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userId
    }

    if (source === 'custom_request' && customText) {
      updateData.direction_request_text = customText
      updateData.direction_giver_response = null // Pending giver response
    }

    // Optimistic update
    setSessionState(prev => prev ? { ...prev, ...updateData } : null)

    try {
      const { error } = await supabase
        .from('session_states')
        .update(updateData)
        .eq('booking_id', booking.id)

      if (error) {
        console.error('[Session] Failed to advance to direction:', error)
        await fetchOrCreateSessionState()
        alert('Failed to advance session. Please try again.')
        return
      }

      // Record milestones
      await recordMilestone('validation_succeeded', {
        validation_attempts: sessionState.validation_attempts,
        direction_selected: direction,
        direction_source: source
      })
      await recordMilestone('phase_transition', {
        from_phase: 'validation',
        to_phase: 'direction',
        direction_selected: direction
      })

      // Update giver metrics (validation succeeded)
      await updateGiverMetrics(true)
    } catch (err) {
      console.error('[Session] Error advancing to direction:', err)
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

  // Handle custom direction response from giver
  const handleGiverCustomDirectionResponse = async (accepted: boolean) => {
    console.log('[Giver] Custom direction response:', accepted)

    if (!sessionState) return

    try {
      const { error } = await supabase
        .from('session_states')
        .update({
          direction_giver_response: accepted ? 'accepted' : 'declined',
          updated_at: new Date().toISOString(),
          updated_by: userId
        })
        .eq('booking_id', booking.id)

      if (error) throw error

      if (!accepted) {
        // If declined, go back to validation
        await updatePhase('validation', 'system')
      }
    } catch (err) {
      console.error('[Session] Error responding to custom direction:', err)
    }
  }

  // Handle safety exit from giver
  const handleGiverSafetyExit = async () => {
    if (!confirm('Are you sure you want to exit for safety reasons? This will end the session and apply pro-rated payout.')) {
      return
    }

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      // Call finalize-session edge function
      const response = await fetch(`${supabaseUrl}/functions/v1/finalize-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          booking_id: booking.id,
          end_reason: 'giver_safety_exit'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to finalize session')
      }

      await updatePhase('ended', 'system')
    } catch (err) {
      console.error('[Session] Error processing safety exit:', err)
      alert('Failed to exit session. Please try again.')
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

    let shouldMicBeOn = false

    if (sessionState.current_phase === 'transmission') {
      shouldMicBeOn = userRole === 'receiver'
    } else if (sessionState.current_phase === 'reflection') {
      shouldMicBeOn = userRole === 'giver'
    } else if (sessionState.current_phase === 'validation') {
      shouldMicBeOn = false // Neither has the floor
    } else if (sessionState.current_phase === 'direction') {
      const direction = sessionState.direction_selected

      if (direction === 'go_deeper') {
        shouldMicBeOn = userRole === 'receiver'
      } else if (direction === 'hear_perspective') {
        shouldMicBeOn = userRole === 'giver'
      } else if (direction === 'think_together' || direction === 'build_next_step') {
        // Manual control in DirectionPhase component
        return
      } else if (direction === 'end_cleanly') {
        shouldMicBeOn = false
      }
    } else if (sessionState.current_phase === 'ended') {
      shouldMicBeOn = false
    }

    try {
      dailyCall.setLocalAudio(shouldMicBeOn)
      console.log(`[Mic] Set to ${shouldMicBeOn ? 'ON' : 'OFF'} for ${userRole} in ${sessionState.current_phase}`)
    } catch (err) {
      console.error('[Mic] Error setting audio state:', err)
    }
  }, [dailyCall, sessionState?.current_phase, sessionState?.direction_selected, userRole])

  // Monitor for manual mic toggles and override
  // (Skip for think_together and build_next_step which have manual control)
  useEffect(() => {
    if (!dailyCall || !sessionState) return

    // Skip enforcement for directions with manual control
    if (sessionState.current_phase === 'direction') {
      const direction = sessionState.direction_selected
      if (direction === 'think_together' || direction === 'build_next_step') {
        return // Don't enforce mic state for these directions
      }
    }

    const handleParticipantUpdated = (event: any) => {
      if (event.participant.local) {
        // Determine expected mic state
        let shouldMicBeOn = false

        if (sessionState.current_phase === 'transmission') {
          shouldMicBeOn = userRole === 'receiver'
        } else if (sessionState.current_phase === 'reflection') {
          shouldMicBeOn = userRole === 'giver'
        } else if (sessionState.current_phase === 'validation') {
          shouldMicBeOn = false
        } else if (sessionState.current_phase === 'direction') {
          const direction = sessionState.direction_selected
          if (direction === 'go_deeper') {
            shouldMicBeOn = userRole === 'receiver'
          } else if (direction === 'hear_perspective') {
            shouldMicBeOn = userRole === 'giver'
          } else if (direction === 'end_cleanly') {
            shouldMicBeOn = false
          }
        } else if (sessionState.current_phase === 'ended') {
          shouldMicBeOn = false
        }

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
  }, [dailyCall, sessionState?.current_phase, sessionState?.direction_selected, userRole])

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

  // Log render state for debugging
  useEffect(() => {
    if (!sessionState) return

    const canLocalSpeak = (
      (sessionState.current_phase === 'transmission' && userRole === 'receiver') ||
      (sessionState.current_phase === 'reflection' && userRole === 'giver') ||
      (sessionState.current_phase === 'direction' && sessionState.direction_selected === 'go_deeper' && userRole === 'receiver') ||
      (sessionState.current_phase === 'direction' && sessionState.direction_selected === 'hear_perspective' && userRole === 'giver') ||
      (sessionState.current_phase === 'direction' && (sessionState.direction_selected === 'think_together' || sessionState.direction_selected === 'build_next_step'))
    )

    let ctaVisible = false
    let ctaLabel = 'none'

    if (sessionState.current_phase === 'transmission' && userRole === 'receiver') {
      ctaVisible = true
      ctaLabel = "I'm done, reflect now"
    } else if (sessionState.current_phase === 'reflection' && userRole === 'giver') {
      ctaVisible = true
      ctaLabel = 'Done reflecting'
    } else if (sessionState.current_phase === 'validation' && userRole === 'receiver') {
      ctaVisible = true
      ctaLabel = 'Yes/No validation'
    }

    console.log('[Render State]', {
      rendered_phase: sessionState.current_phase,
      authoritative_phase: sessionState.current_phase,
      local_role: userRole,
      CTA_visible: ctaVisible,
      CTA_label: ctaLabel,
      can_local_speak: canLocalSpeak
    })
  }, [sessionState?.current_phase, userRole, sessionState?.direction_selected])

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

      {/* Phase Indicator - always visible at top */}
      <PhaseIndicator currentPhase={sessionState.current_phase} />

      {/* Phase-specific UI - rendered as fixed overlays */}
      {sessionState.current_phase === 'transmission' && (
        <TransmissionPhase
          userRole={userRole}
          sessionTimeRemaining={sessionTimeRemaining}
          onDone={handleReceiverDoneTransmission}
        />
      )}

      {sessionState.current_phase === 'reflection' && (
        <ReflectionPhase
          userRole={userRole}
          sessionTimeRemaining={sessionTimeRemaining}
          onDone={handleGiverDoneReflection}
        />
      )}

      {sessionState.current_phase === 'validation' && (
        <ValidationPhase
          userRole={userRole}
          validationAttempts={sessionState.validation_attempts}
          sessionTimeRemaining={sessionTimeRemaining}
          onYes={handleReceiverValidationYes}
          onNo={handleReceiverValidationNo}
          listingId={null}
        />
      )}

      {sessionState.current_phase === 'direction' && (
        <DirectionPhase
          userRole={userRole}
          directionSelected={sessionState.direction_selected}
          directionSource={sessionState.direction_source}
          directionRequestText={sessionState.direction_request_text}
          directionGiverResponse={sessionState.direction_giver_response}
          sessionTimeRemaining={sessionTimeRemaining}
          onRequestExtension={onRequestExtension}
          onGiverCustomDirectionResponse={handleGiverCustomDirectionResponse}
          onSafetyExit={handleGiverSafetyExit}
          dailyCall={dailyCall}
        />
      )}

      {sessionState.current_phase === 'ended' && (
        <SessionEndedSummary
          endReason={sessionState.end_reason || 'completed'}
        />
      )}
    </div>
  )
}
