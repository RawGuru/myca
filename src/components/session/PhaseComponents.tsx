import React, { useState, useEffect } from 'react'
import type { DirectionType } from '../../SessionStateMachine'
import type { DailyCall } from '@daily-co/daily-js'
import { supabase } from '../../lib/supabase'

// ============================================
// SHARED STYLES & TYPES
// ============================================

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

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(10, 10, 10, 0.95)',
  zIndex: 100,
  padding: '40px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}

const buttonStyle: React.CSSProperties = {
  padding: '18px 30px',
  borderRadius: '3px',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  background: colors.accent,
  color: colors.bgPrimary,
}

const buttonSecondaryStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'transparent',
  color: colors.textPrimary,
  border: `1px solid ${colors.border}`,
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
      padding: '15px 20px',
      zIndex: 99,
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '0.9rem',
        color: colors.textSecondary,
        marginBottom: '8px',
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
  onDone: () => void
}

export function TransmissionPhase({ userRole, onDone }: TransmissionPhaseProps) {
  const onComplete = onDone // Use consistent naming internally
  return (
    <div style={overlayStyle}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        {userRole === 'receiver' ? (
          <>
            <div style={{
              fontSize: '3rem',
              marginBottom: '20px'
            }}>
              🎙️
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '15px',
              color: colors.textPrimary
            }}>
              Your Transmission
            </h2>
            <p style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginBottom: '30px'
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
              fontSize: '3rem',
              marginBottom: '20px'
            }}>
              👂
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '15px',
              color: colors.textPrimary
            }}>
              Listening
            </h2>
            <p style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginBottom: '15px'
            }}>
              One person speaks. One person listens. The app enforces it.
            </p>
            <p style={{
              fontSize: '0.9rem',
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
  onDone: () => void
}

export function ReflectionPhase({ userRole, onDone }: ReflectionPhaseProps) {
  const onComplete = onDone // Use consistent naming internally
  return (
    <div style={overlayStyle}>
      <div style={{ maxWidth: '400px', textAlign: 'center' }}>
        {userRole === 'giver' ? (
          <>
            <div style={{
              fontSize: '3rem',
              marginBottom: '20px'
            }}>
              🔄
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '15px',
              color: colors.textPrimary
            }}>
              Your Reflection
            </h2>
            <p style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginBottom: '10px'
            }}>
              Here is what I think you're saying.
            </p>
            <p style={{
              fontSize: '0.9rem',
              color: colors.textMuted,
              marginBottom: '30px'
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
              marginBottom: '20px'
            }}>
              👂
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 600,
              marginBottom: '15px',
              color: colors.textPrimary
            }}>
              Receiving Reflection
            </h2>
            <p style={{
              fontSize: '1rem',
              lineHeight: 1.6,
              color: colors.textSecondary,
              marginBottom: '15px'
            }}>
              The giver is reflecting what they heard. Listen and feel if you were truly understood. Your mic is OFF.
            </p>
            <p style={{
              fontSize: '0.9rem',
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
  onYes: (direction: DirectionType, source: 'pre_consented' | 'custom_request', customText?: string) => void
  onNo: () => void
  listingId: string
}

export function ValidationPhase({ userRole, validationAttempts, onYes, onNo, listingId }: ValidationPhaseProps) {
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
            marginBottom: '20px'
          }}>
            ⏳
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 600,
            marginBottom: '15px',
            color: colors.textPrimary
          }}>
            Waiting for Validation
          </h2>
          <p style={{
            fontSize: '1rem',
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
              marginBottom: '20px',
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ← Back
          </button>
          <h2 style={{
            fontSize: '1.3rem',
            fontWeight: 600,
            marginBottom: '20px',
            color: colors.textPrimary
          }}>
            Request Custom Direction
          </h2>
          <p style={{
            fontSize: '0.9rem',
            color: colors.textSecondary,
            marginBottom: '15px'
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
              padding: '12px',
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '3px',
              color: colors.textPrimary,
              fontSize: '1rem',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
          <p style={{
            fontSize: '0.75rem',
            color: colors.textMuted,
            marginTop: '5px',
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
              marginTop: '15px',
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
            fontSize: '1.3rem',
            fontWeight: 600,
            marginBottom: '20px',
            color: colors.textPrimary,
            textAlign: 'center'
          }}>
            What would you like next?
          </h2>

          {/* Pre-consented directions */}
          <div style={{
            display: 'grid',
            gap: '12px',
            marginBottom: '15px'
          }}>
            {allowedDirections.map(direction => (
              <button
                key={direction}
                onClick={() => onYes(direction, 'pre_consented')}
                style={{
                  padding: '16px',
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
                  fontSize: '0.85rem',
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
          marginBottom: '20px'
        }}>
          ✓
        </div>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 600,
          marginBottom: '15px',
          color: colors.textPrimary
        }}>
          Did they understand you?
        </h2>
        <p style={{
          fontSize: '1rem',
          lineHeight: 1.6,
          color: colors.textSecondary,
          marginBottom: '30px'
        }}>
          You decide if you were understood. Not them.
        </p>

        {validationAttempts > 0 && (
          <p style={{
            fontSize: '0.9rem',
            color: colors.accent,
            marginBottom: '20px'
          }}>
            Validation attempt {validationAttempts + 1}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          fontSize: '0.85rem',
          color: colors.textMuted,
          marginTop: '20px',
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
  onSafetyExit: () => void
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
  onSafetyExit,
  dailyCall
}: DirectionPhaseProps) {
  const [turnState, setTurnState] = useState<'turn1' | 'turn2' | 'completed'>('turn1')
  const [micOwner, setMicOwner] = useState<'receiver' | 'giver'>('receiver')

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
          <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '20px', color: colors.textPrimary }}>
            Custom Direction Request
          </h2>
          <p style={{ fontSize: '1rem', color: colors.textSecondary, marginBottom: '20px', lineHeight: 1.6 }}>
            The receiver has requested:
          </p>
          <div style={{
            background: colors.bgCard,
            padding: '20px',
            borderRadius: '3px',
            marginBottom: '30px',
            border: `1px solid ${colors.border}`
          }}>
            <p style={{ fontSize: '1.1rem', color: colors.textPrimary, lineHeight: 1.6 }}>
              "{directionRequestText}"
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
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
        padding: '15px 20px',
        zIndex: 98,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: colors.accent, marginBottom: '5px', fontWeight: 600 }}>
          {directionLabels[directionSelected]}
        </div>
        <div style={{ fontSize: '1.2rem', color: colors.textPrimary, fontFamily: 'monospace', marginBottom: '10px' }}>
          {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
        </div>

        {turnState === 'turn1' && (
          <div>
            <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px' }}>
              Turn 1: Receiver proposes next step (Giver listens)
            </p>
            {userRole === 'receiver' && (
              <button style={{ ...buttonStyle, fontSize: '0.85rem', padding: '10px 20px' }} onClick={handleTurn1Done}>
                Done Proposing
              </button>
            )}
          </div>
        )}

        {turnState === 'turn2' && (
          <div>
            <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px' }}>
              Turn 2: Giver responds to proposal (Receiver listens)
            </p>
            {userRole === 'giver' && (
              <button style={{ ...buttonStyle, fontSize: '0.85rem', padding: '10px 20px' }} onClick={handleTurn2Done}>
                Done Responding
              </button>
            )}
          </div>
        )}

        {turnState === 'completed' && (
          <p style={{ fontSize: '0.9rem', color: colors.accent }}>
            Template complete - continue or wind down
          </p>
        )}

        {userRole === 'giver' && (
          <button
            style={{
              ...buttonSecondaryStyle,
              fontSize: '0.75rem',
              padding: '8px 16px',
              marginTop: '10px',
              borderColor: colors.error,
              color: colors.error
            }}
            onClick={onSafetyExit}
          >
            Safety Exit
          </button>
        )}
      </div>
    )
  }

  // Handle think_together manual turn passing
  if (directionSelected === 'think_together') {
    const handlePassTurn = () => {
      const newOwner = micOwner === 'receiver' ? 'giver' : 'receiver'
      setMicOwner(newOwner)
      if (dailyCall) {
        dailyCall.setLocalAudio(userRole === newOwner)
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
        padding: '15px 20px',
        zIndex: 98,
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: colors.accent, marginBottom: '5px', fontWeight: 600 }}>
          {directionLabels[directionSelected]}
        </div>
        <div style={{ fontSize: '1.2rem', color: colors.textPrimary, fontFamily: 'monospace', marginBottom: '10px' }}>
          {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
        </div>

        <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px' }}>
          Current speaker: {micOwner === 'receiver' ? 'Receiver' : 'Giver'}
        </p>

        <button
          style={{ ...buttonStyle, fontSize: '0.85rem', padding: '10px 20px' }}
          onClick={handlePassTurn}
        >
          Pass Turn
        </button>

        {showExtensionOption && (
          <button
            style={{ ...buttonStyle, fontSize: '0.85rem', padding: '10px 20px', marginTop: '10px' }}
            onClick={onRequestExtension}
          >
            Request +30 minutes
          </button>
        )}

        {userRole === 'giver' && (
          <button
            style={{
              ...buttonSecondaryStyle,
              fontSize: '0.75rem',
              padding: '8px 16px',
              marginTop: '10px',
              borderColor: colors.error,
              color: colors.error
            }}
            onClick={onSafetyExit}
          >
            Safety Exit
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
      padding: '15px 20px',
      zIndex: 98,
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '0.85rem', color: colors.accent, marginBottom: '5px', fontWeight: 600 }}>
        {directionSelected ? directionLabels[directionSelected] : 'Direction Phase'}
      </div>
      <div style={{ fontSize: '1.2rem', color: colors.textPrimary, fontFamily: 'monospace' }}>
        {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
      </div>

      {showExtensionOption && (
        <button
          style={{ ...buttonStyle, fontSize: '0.85rem', padding: '10px 20px', marginTop: '10px' }}
          onClick={onRequestExtension}
        >
          Request +30 minutes
        </button>
      )}

      {userRole === 'giver' && (
        <button
          style={{
            ...buttonSecondaryStyle,
            fontSize: '0.75rem',
            padding: '8px 16px',
            marginTop: '10px',
            borderColor: colors.error,
            color: colors.error
          }}
          onClick={onSafetyExit}
        >
          Safety Exit
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
          marginBottom: '20px'
        }}>
          ✨
        </div>
        <h2 style={{
          fontSize: '1.8rem',
          fontWeight: 600,
          marginBottom: '20px',
          color: colors.textPrimary
        }}>
          Session Ended
        </h2>

        <p style={{
          fontSize: '1rem',
          lineHeight: 1.6,
          color: colors.textSecondary,
          marginBottom: '30px'
        }}>
          {reasonMessages[endReason]}
        </p>

        <p style={{
          fontSize: '0.9rem',
          color: colors.textMuted
        }}>
          Please proceed to feedback
        </p>
      </div>
    </div>
  )
}
