import React from 'react'
import type { EmergenceVerb } from '../../SessionStateMachine'

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
  currentPhase: 'transmission' | 'reflection' | 'validation' | 'emergence' | 'ended'
}

export function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const phase = currentPhase // Use consistent naming internally
  const phaseLabels = {
    transmission: 'Transmission',
    reflection: 'Reflection',
    validation: 'Validation',
    emergence: 'Emergence',
    ended: 'Complete'
  }

  const phaseIndex = {
    transmission: 0,
    reflection: 1,
    validation: 2,
    emergence: 3,
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
  onYes: (verb: EmergenceVerb) => void
  onNo: () => void
}

export function ValidationPhase({ userRole, validationAttempts, onYes, onNo }: ValidationPhaseProps) {
  const [showVerbSelector, setShowVerbSelector] = React.useState(false)
  const [selectedVerb, setSelectedVerb] = React.useState<EmergenceVerb | null>(null)

  const verbs: Array<{ value: EmergenceVerb; label: string; description: string }> = [
    { value: 'explore', label: 'Explore together', description: 'Discover new perspectives' },
    { value: 'strategize', label: 'Strategize solutions', description: 'Plan concrete next steps' },
    { value: 'reflect_deeper', label: 'Reflect deeper', description: 'Go further into what emerged' },
    { value: 'challenge', label: 'Challenge my thinking', description: 'Push back on my assumptions' },
    { value: 'synthesize', label: 'Synthesize insights', description: 'Connect the threads together' },
    { value: 'just_talk', label: 'Just talk freely', description: 'Open conversation' }
  ]

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

  if (showVerbSelector) {
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
            Given that you now feel understood, what, if anything, would you like from me next?
          </h2>
          <div style={{
            display: 'grid',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {verbs.map(verb => (
              <button
                key={verb.value}
                onClick={() => setSelectedVerb(verb.value)}
                style={{
                  padding: '16px',
                  background: selectedVerb === verb.value ? colors.accentSoft : colors.bgCard,
                  border: `1px solid ${selectedVerb === verb.value ? colors.accent : colors.border}`,
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
                  color: selectedVerb === verb.value ? colors.accent : colors.textPrimary
                }}>
                  {verb.label}
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  color: colors.textSecondary
                }}>
                  {verb.description}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => selectedVerb && onYes(selectedVerb)}
            disabled={!selectedVerb}
            style={{
              ...buttonStyle,
              width: '100%',
              opacity: selectedVerb ? 1 : 0.5,
              cursor: selectedVerb ? 'pointer' : 'not-allowed'
            }}
          >
            Continue to Emergence
          </button>
        </div>
      </div>
    )
  }

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
            onClick={() => setShowVerbSelector(true)}
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
// EMERGENCE PHASE
// ============================================

interface EmergencePhaseProps {
  userRole: 'receiver' | 'giver'
  emergenceVerb: EmergenceVerb | null
  sessionTimeRemaining: number
  onRequestExtension?: () => void
}

export function EmergencePhase({ userRole, emergenceVerb, sessionTimeRemaining, onRequestExtension }: EmergencePhaseProps) {
  const verbLabels: Record<EmergenceVerb, string> = {
    explore: 'Exploring together',
    strategize: 'Strategizing solutions',
    reflect_deeper: 'Reflecting deeper',
    challenge: 'Challenging thinking',
    synthesize: 'Synthesizing insights',
    just_talk: 'Talking freely'
  }

  const minutesRemaining = Math.floor(sessionTimeRemaining / 60)
  const secondsRemaining = sessionTimeRemaining % 60

  // Show extension option at 3 minutes remaining for receiver
  const showExtensionOption = userRole === 'receiver' && sessionTimeRemaining <= 180 && sessionTimeRemaining > 0 && onRequestExtension

  return (
    <div style={{
      position: 'fixed',
      top: '70px', // Below phase indicator
      left: 0,
      right: 0,
      background: colors.bgSecondary,
      borderBottom: `1px solid ${colors.border}`,
      padding: '15px 20px',
      zIndex: 98,
      textAlign: 'center'
    }}>
      <div style={{
        fontSize: '0.85rem',
        color: colors.accent,
        marginBottom: '5px',
        fontWeight: 600
      }}>
        {emergenceVerb ? verbLabels[emergenceVerb] : 'Free conversation'}
      </div>
      <div style={{
        fontSize: '1.2rem',
        color: colors.textPrimary,
        fontFamily: 'monospace'
      }}>
        {minutesRemaining}:{secondsRemaining.toString().padStart(2, '0')}
      </div>

      {showExtensionOption && (
        <button
          style={{
            ...buttonStyle,
            fontSize: '0.85rem',
            padding: '10px 20px',
            marginTop: '10px'
          }}
          onClick={onRequestExtension}
        >
          Request +30 minutes
        </button>
      )}
    </div>
  )
}

// ============================================
// SESSION ENDED SUMMARY
// ============================================

interface SessionEndedSummaryProps {
  endReason: 'completed' | 'time_expired' | 'participant_left' | 'error'
}

export function SessionEndedSummary({ endReason }: SessionEndedSummaryProps) {
  const reasonMessages = {
    completed: 'Session completed successfully',
    time_expired: 'Time has expired',
    participant_left: 'A participant left the session',
    error: 'Session ended due to an error'
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
