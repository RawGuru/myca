import React, { useState, useEffect } from 'react'
import type { DirectionType } from '../../SessionStateMachine'
import type { DailyCall } from '@daily-co/daily-js'
import { supabase } from '../../lib/supabase'
import { BLOCK_MINUTES } from '../../App'

// ============================================
// SHARED STYLES & TYPES
// ============================================

const colors = {
  bgPrimary: '#060606',
  bgSecondary: '#0B0B0C',
  bgCard: '#111214',
  textPrimary: '#F4F1EA',
  textSecondary: 'rgba(244, 241, 234, 0.72)',
  textMuted: 'rgba(244, 241, 234, 0.48)',
  accent: '#C8AE6A',
  accentHover: '#D7BE7D',
  accentSoft: 'rgba(200, 174, 106, 0.1)',
  border: 'rgba(255,255,255,0.08)',
  borderEmphasis: 'rgba(200,174,106,0.35)',
  success: '#C8AE6A',
  error: '#d9534f',
}

// Typography scale (6-step system)
const typography = {
  xs: '0.75rem',
  sm: '0.85rem',
  base: '0.95rem',
  md: '1rem',
  lg: '1.2rem',
  xl: '1.5rem',
}

// Spacing scale (4px base unit)
const spacing = {
  xs: '8px',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '24px',
  xxl: '32px',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'rgba(10, 10, 10, 0.96)',
  backdropFilter: 'blur(10px)',
  zIndex: 50,
  padding: spacing.md,
  paddingBottom: `max(${spacing.md}, env(safe-area-inset-bottom))`, // Respect safe area on iOS
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  maxHeight: '50dvh', // Use dynamic viewport height, allow more space for controls
  overflowY: 'auto',
  overflowX: 'hidden',
}

const buttonStyle: React.CSSProperties = {
  padding: `14px ${spacing.xl}`,
  borderRadius: '3px',
  fontSize: typography.base,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  minHeight: '48px',
  background: colors.accent,
  color: colors.bgPrimary,
  width: '100%',
  maxWidth: '320px',
  transition: 'all 0.15s ease',
}

const buttonSecondaryStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'transparent',
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
  fontWeight: 500,
}

// ============================================
// PHASE INDICATOR
// ============================================

interface PhaseIndicatorProps {
  currentPhase: 'transmission' | 'reflection' | 'validation' | 'direction' | 'ended'
}

export function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const phase = currentPhase // Use consistent naming internally
  const phaseLabels = {
    transmission: 'Transmission',
    reflection: 'Reflection',
    validation: 'Validation',
    direction: 'Direction',
    ended: 'Complete'
  }

  const phaseIndex = {
    transmission: 0,
    reflection: 1,
    validation: 2,
    direction: 3,
    ended: 4
  }

  const progress = ((phaseIndex[phase] + 1) / 5) * 100

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      padding: `${spacing.md} ${spacing.lg}`,
      zIndex: 99,
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: typography.sm,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        fontWeight: 600
      }}>
        {phaseLabels[phase]}
      </div>
      <div style={{
        width: '100%',
        height: '4px',
        background: colors.border,
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: colors.accent,
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  )
}

// ============================================
// TRANSMISSION PHASE
// ============================================

interface TransmissionPhaseProps {
  userRole: 'receiver' | 'giver'
  sessionTimeRemaining: number
  onDone: () => void
}

export function TransmissionPhase({ userRole, sessionTimeRemaining, onDone }: TransmissionPhaseProps) {
  const onComplete = onDone // Use consistent naming internally
  const minutesRemaining = Math.floor(sessionTimeRemaining / 60)
  const secondsRemaining = sessionTimeRemaining % 60

  return (
    <div style={overlayStyle}>
      <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center' }}>
        {userRole === 'receiver' ? (
          <>
            <div style={{
              fontSize: '2.5rem',
              marginBottom: spacing.sm
            }}>
              🎙️
            </div>
            <h2 style={{
              fontSize: typography.xl,
              fontWeight: 600,
              marginBottom: spacing.sm,
              color: colors.textPrimary
            }}>
              Your Transmission
            </h2>
            <div style={{
              fontSize: typography.lg,
              color: colors.textPrimary,
              fontFamily: 'monospace',
              marginBottom: spacing.md,
              fontWeight: 500
            }}>
              {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
            </div>
            <p style={{
              fontSize: typography.base,
              lineHeight: 1.5,
              color: colors.textSecondary,
              marginBottom: spacing.lg
            }}>
              Speak until you feel complete. Nothing else is required right now.
            </p>
            <button
              style={buttonStyle}
              onClick={onComplete}
            >
              I'm done, reflect now
            </button>
          </>
        ) : (
          <>
            <div style={{
              fontSize: '2.5rem',
              marginBottom: spacing.sm
            }}>
              👂
            </div>
            <h2 style={{
              fontSize: typography.xl,
              fontWeight: 600,
              marginBottom: spacing.sm,
              color: colors.textPrimary
            }}>
              Listening
            </h2>
            <div style={{
              fontSize: typography.lg,
              color: colors.textPrimary,
              fontFamily: 'monospace',
              marginBottom: spacing.md,
              fontWeight: 500
            }}>
              {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
            </div>
            <p style={{
              fontSize: typography.base,
              lineHeight: 1.5,
              color: colors.textSecondary,
              marginBottom: spacing.sm
            }}>
              One person speaks. One person listens. The app enforces it.
            </p>
            <p style={{
              fontSize: typography.sm,
              color: colors.textMuted
            }}>
              Your mic is OFF
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================
// REFLECTION PHASE
// ============================================

interface ReflectionPhaseProps {
  userRole: 'receiver' | 'giver'
  sessionTimeRemaining: number
  onDone: () => void
}

export function ReflectionPhase({ userRole, sessionTimeRemaining, onDone }: ReflectionPhaseProps) {
  const onComplete = onDone // Use consistent naming internally
  const minutesRemaining = Math.floor(sessionTimeRemaining / 60)
  const secondsRemaining = sessionTimeRemaining % 60

  return (
    <div style={overlayStyle}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        {userRole === 'giver' ? (
          <>
            <div style={{
              fontSize: '3rem',
              marginBottom: spacing.lg
            }}>
              🔄
            </div>
            <h2 style={{
              fontSize: typography.xl,
              fontWeight: 600,
              marginBottom: spacing.md,
              color: colors.textPrimary
            }}>
              Your Reflection
            </h2>
            <div style={{
              fontSize: typography.lg,
              color: colors.textPrimary,
              fontFamily: 'monospace',
              marginBottom: spacing.md,
              fontWeight: 500
            }}>
              {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
            </div>
            <p style={{
              fontSize: typography.md,
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginBottom: spacing.sm
            }}>
              Here is what I think you're saying.
            </p>
            <p style={{
              fontSize: typography.sm,
              color: colors.textMuted,
              marginBottom: spacing.xxl
            }}>
              Accuracy matters more than insight.
            </p>
            <button
              style={buttonStyle}
              onClick={onComplete}
            >
              Done reflecting
            </button>
          </>
        ) : (
          <>
            <div style={{
              fontSize: '3rem',
              marginBottom: spacing.lg
            }}>
              👂
            </div>
            <h2 style={{
              fontSize: typography.xl,
              fontWeight: 600,
              marginBottom: spacing.md,
              color: colors.textPrimary
            }}>
              Receiving Reflection
            </h2>
            <div style={{
              fontSize: typography.lg,
              color: colors.textPrimary,
              fontFamily: 'monospace',
              marginBottom: spacing.md,
              fontWeight: 500
            }}>
              {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
            </div>
            <p style={{
              fontSize: typography.md,
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginBottom: spacing.md
            }}>
              The giver is reflecting what they heard. Listen and feel if you were truly understood. Your mic is OFF.
            </p>
            <p style={{
              fontSize: typography.sm,
              color: colors.textMuted
            }}>
              You'll validate next
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================
// VALIDATION PHASE
// ============================================

interface ValidationPhaseProps {
  userRole: 'receiver' | 'giver'
  validationAttempts: number
  sessionTimeRemaining: number
  onYes: (direction: DirectionType, source: 'pre_consented' | 'custom_request', customText?: string) => void
  onNo: () => void
  listingId?: string | null // Optional - multi-listing feature removed
}

export function ValidationPhase({ userRole, validationAttempts, sessionTimeRemaining, onYes, onNo, listingId }: ValidationPhaseProps) {
  const minutesRemaining = Math.floor(sessionTimeRemaining / 60)
  const secondsRemaining = sessionTimeRemaining % 60
  const [showDirectionSelector, setShowDirectionSelector] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customText, setCustomText] = useState('')
  const [allowedDirections, setAllowedDirections] = useState<DirectionType[]>([])

  // Fetch giver's allowed directions
  useEffect(() => {
    const fetchAllowedDirections = async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('directions_allowed')
        .eq('id', listingId)
        .single()

      if (!error && data) {
        setAllowedDirections(data.directions_allowed || [])
      }
    }

    if (listingId) {
      fetchAllowedDirections()
    } else {
      // No listing - allow all directions by default (multi-listing feature removed)
      setAllowedDirections(['go_deeper', 'hear_perspective', 'think_together', 'build_next_step', 'end_cleanly'])
    }
  }, [listingId])

  const allDirections: Record<DirectionType, { label: string; description: string }> = {
    go_deeper: { label: 'Go deeper', description: 'Explore this further together' },
    hear_perspective: { label: 'Hear your perspective', description: 'Share your thoughts' },
    think_together: { label: 'Think together', description: 'Collaborative dialogue' },
    build_next_step: { label: 'Define next step', description: 'Plan concrete actions' },
    end_cleanly: { label: 'Wind down', description: 'Finish gracefully' }
  }

  if (userRole === 'giver') {
    return (
      <div style={overlayStyle}>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: spacing.lg
          }}>
            ⏳
          </div>
          <h2 style={{
            fontSize: typography.xl,
            fontWeight: 600,
            marginBottom: spacing.md,
            color: colors.textPrimary
          }}>
            Waiting for Validation
          </h2>
          <div style={{
            fontSize: typography.lg,
            color: colors.textPrimary,
            fontFamily: 'monospace',
            marginBottom: spacing.md,
            fontWeight: 500
          }}>
            {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
          </div>
          <p style={{
            fontSize: typography.md,
            lineHeight: 1.6,
            color: colors.textSecondary
          }}>
            The receiver is reviewing whether you understood them.
          </p>
        </div>
      </div>
    )
  }

  // Custom direction text input
  if (showCustomInput) {
    return (
      <div style={overlayStyle}>
        <div style={{ maxWidth: '450px', width: '100%' }}>
          <button
            onClick={() => {
              setShowCustomInput(false)
              setCustomText('')
            }}
            style={{
              marginBottom: spacing.lg,
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: typography.sm
            }}
          >
            ← Back
          </button>
          <h2 style={{
            fontSize: typography.xl,
            fontWeight: 600,
            marginBottom: spacing.lg,
            color: colors.textPrimary
          }}>
            Request Custom Direction
          </h2>
          <p style={{
            fontSize: typography.sm,
            color: colors.textSecondary,
            marginBottom: spacing.md
          }}>
            Describe what you'd like from the giver (200 character limit)
          </p>
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value.slice(0, 200))}
            placeholder="I would like..."
            style={{
              width: '100%',
              minHeight: '100px',
              padding: spacing.sm,
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '3px',
              color: colors.textPrimary,
              fontSize: typography.md,
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
          <p style={{
            fontSize: typography.xs,
            color: colors.textMuted,
            marginTop: '6px',
            textAlign: 'right'
          }}>
            {customText.length}/200
          </p>
          <button
            onClick={() => customText.trim() && onYes('go_deeper', 'custom_request', customText)}
            disabled={!customText.trim()}
            style={{
              ...buttonStyle,
              width: '100%',
              marginTop: spacing.md,
              opacity: customText.trim() ? 1 : 0.5,
              cursor: customText.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Send Request to Giver
          </button>
        </div>
      </div>
    )
  }

  // Direction selector
  if (showDirectionSelector) {
    return (
      <div style={overlayStyle}>
        <div style={{ maxWidth: '450px', width: '100%' }}>
          <h2 style={{
            fontSize: typography.xl,
            fontWeight: 600,
            marginBottom: spacing.lg,
            color: colors.textPrimary,
            textAlign: 'center'
          }}>
            What would you like next?
          </h2>

          {/* Pre-consented directions */}
          <div style={{
            display: 'grid',
            gap: spacing.sm,
            marginBottom: spacing.md
          }}>
            {allowedDirections.map(direction => (
              <button
                key={direction}
                onClick={() => onYes(direction, 'pre_consented')}
                style={{
                  padding: spacing.md,
                  background: colors.bgCard,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                <div style={{
                  fontWeight: 500,
                  marginBottom: '4px',
                  color: colors.accent
                }}>
                  {allDirections[direction].label}
                </div>
                <div style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary
                }}>
                  {allDirections[direction].description}
                </div>
              </button>
            ))}
          </div>

          {/* Request something else */}
          <button
            onClick={() => setShowCustomInput(true)}
            style={{
              ...buttonSecondaryStyle,
              width: '100%'
            }}
          >
            Request something else
          </button>
        </div>
      </div>
    )
  }

  // Initial validation screen
  return (
    <div style={overlayStyle}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: spacing.lg
        }}>
          ✓
        </div>
        <h2 style={{
          fontSize: typography.xl,
          fontWeight: 600,
          marginBottom: spacing.md,
          color: colors.textPrimary
        }}>
          Did they understand you?
        </h2>
        <div style={{
          fontSize: typography.lg,
          color: colors.textPrimary,
          fontFamily: 'monospace',
          marginBottom: spacing.md,
          fontWeight: 500
        }}>
          {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
        </div>
        <p style={{
          fontSize: typography.md,
          lineHeight: 1.6,
          color: colors.textSecondary,
          marginBottom: spacing.xxl
        }}>
          You decide if you were understood. Not them.
        </p>

        {validationAttempts > 0 && (
          <p style={{
            fontSize: typography.sm,
            color: colors.accent,
            marginBottom: spacing.lg
          }}>
            Validation attempt {validationAttempts + 1}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <button
            style={{ ...buttonStyle, background: colors.success }}
            onClick={() => setShowDirectionSelector(true)}
          >
            Yes, you understood me
          </button>
          <button
            style={{ ...buttonSecondaryStyle, borderColor: colors.error, color: colors.error }}
            onClick={onNo}
          >
            No, something is missing
          </button>
        </div>

        <p style={{
          fontSize: typography.sm,
          color: colors.textMuted,
          marginTop: spacing.lg,
          lineHeight: 1.5
        }}>
          Choosing "No" will restart from transmission to clarify.
        </p>
      </div>
    </div>
  )
}

// ============================================
// DIRECTION PHASE
// ============================================

interface DirectionPhaseProps {
  userRole: 'receiver' | 'giver'
  directionSelected: DirectionType | null
  directionSource: 'pre_consented' | 'custom_request' | null
  directionRequestText: string | null
  directionGiverResponse: 'accepted' | 'declined' | null
  sessionTimeRemaining: number
  onRequestExtension?: () => void
  onGiverCustomDirectionResponse: (accepted: boolean) => void
  dailyCall: DailyCall | null
}

export function DirectionPhase({
  userRole,
  directionSelected,
  directionSource,
  directionRequestText,
  directionGiverResponse,
  sessionTimeRemaining,
  onRequestExtension,
  onGiverCustomDirectionResponse,
  dailyCall
}: DirectionPhaseProps) {
  const [turnState, setTurnState] = useState<'turn1' | 'turn2' | 'completed'>('turn1')

  const directionLabels: Record<DirectionType, string> = {
    go_deeper: 'Going Deeper',
    hear_perspective: 'Hearing Perspective',
    think_together: 'Thinking Together',
    build_next_step: 'Defining Next Step',
    end_cleanly: 'Winding Down'
  }

  const minutesRemaining = Math.floor(sessionTimeRemaining / 60)
  const secondsRemaining = sessionTimeRemaining % 60
  const showExtensionOption = userRole === 'receiver' && sessionTimeRemaining <= 180 && sessionTimeRemaining > 0 && onRequestExtension

  // Handle custom direction giver modal
  if (directionSource === 'custom_request' && !directionGiverResponse && userRole === 'giver') {
    return (
      <div style={overlayStyle}>
        <div style={{ maxWidth: '450px', textAlign: 'center' }}>
          <h2 style={{ fontSize: typography.xl, fontWeight: 600, marginBottom: spacing.lg, color: colors.textPrimary }}>
            Custom Direction Request
          </h2>
          <p style={{ fontSize: typography.md, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 1.6 }}>
            The receiver has requested:
          </p>
          <div style={{
            background: colors.bgCard,
            padding: spacing.lg,
            borderRadius: '3px',
            marginBottom: spacing.xxl,
            border: `1px solid ${colors.border}`
          }}>
            <p style={{ fontSize: typography.lg, color: colors.textPrimary, lineHeight: 1.6 }}>
              "{directionRequestText}"
            </p>
          </div>
          <div style={{ display: 'flex', gap: spacing.sm }}>
            <button
              style={{ ...buttonStyle, flex: 1 }}
              onClick={() => onGiverCustomDirectionResponse(true)}
            >
              Accept
            </button>
            <button
              style={{ ...buttonSecondaryStyle, flex: 1 }}
              onClick={() => onGiverCustomDirectionResponse(false)}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Handle build_next_step template
  if (directionSelected === 'build_next_step') {
    const handleTurn1Done = () => {
      setTurnState('turn2')
      if (dailyCall) {
        dailyCall.setLocalAudio(userRole === 'giver')
      }
    }

    const handleTurn2Done = () => {
      setTurnState('completed')
      if (dailyCall) {
        dailyCall.setLocalAudio(false)
      }
    }

    return (
      <div style={{
        position: 'fixed',
        top: '70px',
        left: 0,
        right: 0,
        background: colors.bgSecondary,
        borderBottom: `1px solid ${colors.border}`,
        padding: `${spacing.md} ${spacing.lg}`,
        zIndex: 98,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: typography.sm, color: colors.accent, marginBottom: '6px', fontWeight: 600 }}>
          {directionLabels[directionSelected]}
        </div>
        <div style={{ fontSize: typography.lg, color: colors.textPrimary, fontFamily: 'monospace', marginBottom: spacing.sm }}>
          {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
        </div>

        {turnState === 'turn1' && (
          <div>
            <p style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>
              Turn 1: Receiver proposes next step (Giver listens)
            </p>
            {userRole === 'receiver' && (
              <button style={{ ...buttonStyle, fontSize: typography.sm, padding: `${spacing.sm} ${spacing.lg}` }} onClick={handleTurn1Done}>
                Done Proposing
              </button>
            )}
          </div>
        )}

        {turnState === 'turn2' && (
          <div>
            <p style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.sm }}>
              Turn 2: Giver responds to proposal (Receiver listens)
            </p>
            {userRole === 'giver' && (
              <button style={{ ...buttonStyle, fontSize: typography.sm, padding: `${spacing.sm} ${spacing.lg}` }} onClick={handleTurn2Done}>
                Done Responding
              </button>
            )}
          </div>
        )}

        {turnState === 'completed' && (
          <p style={{ fontSize: typography.sm, color: colors.accent }}>
            Template complete - continue or wind down
          </p>
        )}
      </div>
    )
  }

  // Handle think_together - open dialogue, no turn passing
  if (directionSelected === 'think_together') {
    return (
      <div style={{
        position: 'fixed',
        top: '70px',
        left: 0,
        right: 0,
        background: colors.bgSecondary,
        borderBottom: `1px solid ${colors.border}`,
        padding: `${spacing.md} ${spacing.lg}`,
        zIndex: 98,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: typography.sm, color: colors.accent, marginBottom: '6px', fontWeight: 600 }}>
          {directionLabels[directionSelected]}
        </div>
        <div style={{ fontSize: typography.lg, color: colors.textPrimary, fontFamily: 'monospace', marginBottom: spacing.sm }}>
          {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
        </div>

        {showExtensionOption && (
          <button
            style={{ ...buttonStyle, fontSize: typography.sm, padding: `${spacing.sm} ${spacing.lg}`, marginTop: spacing.sm }}
            onClick={onRequestExtension}
          >
            Request +{BLOCK_MINUTES} minutes
          </button>
        )}
      </div>
    )
  }

  // Default direction UI (go_deeper, hear_perspective, end_cleanly)
  return (
    <div style={{
      position: 'fixed',
      top: '70px',
      left: 0,
      right: 0,
      background: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      padding: `${spacing.md} ${spacing.lg}`,
      zIndex: 98,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: typography.sm, color: colors.accent, marginBottom: '6px', fontWeight: 600 }}>
        {directionSelected ? directionLabels[directionSelected] : 'Direction Phase'}
      </div>
      <div style={{ fontSize: typography.lg, color: colors.textPrimary, fontFamily: 'monospace' }}>
        {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
      </div>

      {showExtensionOption && (
        <button
          style={{ ...buttonStyle, fontSize: typography.sm, padding: `${spacing.sm} ${spacing.lg}`, marginTop: spacing.sm }}
          onClick={onRequestExtension}
        >
          Request +{BLOCK_MINUTES} minutes
        </button>
      )}
    </div>
  )
}

// ============================================
// SESSION ENDED SUMMARY
// ============================================

interface SessionEndedSummaryProps {
  endReason: 'completed' | 'time_expired' | 'participant_left' | 'error' |
             'receiver_end_complete' | 'giver_safety_exit' | 'technical_failure' |
             'receiver_no_show' | 'giver_no_show'
}

export function SessionEndedSummary({ endReason }: SessionEndedSummaryProps) {
  const reasonMessages = {
    completed: 'Session completed successfully',
    time_expired: 'Time has expired',
    participant_left: 'A participant left the session',
    error: 'Session ended due to an error',
    receiver_end_complete: 'Session completed successfully',
    giver_safety_exit: 'Session ended - Safety exit',
    technical_failure: 'Session ended - Technical issue',
    receiver_no_show: 'Session ended - Receiver did not show',
    giver_no_show: 'Session ended - Giver did not show'
  }

  return (
    <div style={overlayStyle}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{
          fontSize: '4rem',
          marginBottom: spacing.lg
        }}>
          ✨
        </div>
        <h2 style={{
          fontSize: typography.xl,
          fontWeight: 600,
          marginBottom: spacing.lg,
          color: colors.textPrimary
        }}>
          Session Ended
        </h2>

        <p style={{
          fontSize: typography.md,
          lineHeight: 1.6,
          color: colors.textSecondary,
          marginBottom: spacing.xxl
        }}>
          {reasonMessages[endReason]}
        </p>

        <p style={{
          fontSize: typography.sm,
          color: colors.textMuted
        }}>
          Please proceed to feedback
        </p>
      </div>
    </div>
  )
}
