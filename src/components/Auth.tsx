// src/components/Auth.tsx
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const colors = {
  bgPrimary: '#0a0a0a',
  bgSecondary: '#141414',
  textPrimary: '#f5f5f5',
  textSecondary: '#a0a0a0',
  accent: '#c9a66b',
  border: '#2a2a2a',
}

interface AuthProps {
  onBack: () => void
}

export default function Auth({ onBack }: AuthProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { error } = mode === 'signin' 
      ? await signIn(email, password)
      : await signUp(email, password)

    if (error) {
      setError(error.message)
    } else if (mode === 'signup') {
      setError('Check your email for confirmation link')
    }
    
    setLoading(false)
  }

  const handleSocialAuth = async (provider: 'google') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) setError(error.message)
  }

  return (
    <div style={{
      background: colors.bgSecondary,
      padding: '30px',
      borderRadius: '20px',
      border: `1px solid ${colors.border}`,
      position: 'relative',
    }}>
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: '15px',
          left: '15px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: colors.bgPrimary,
          border: `1px solid ${colors.border}`,
          color: colors.textPrimary,
          cursor: 'pointer',
          fontSize: '1.2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ←
      </button>

      <h2 style={{ marginBottom: '25px', marginTop: '10px', fontFamily: 'Georgia, serif', fontSize: '2rem', textAlign: 'center' }}>
        {mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </h2>

      <div style={{ marginBottom: '25px' }}>
        <button
          onClick={() => handleSocialAuth('google')}
          style={{
            width: '100%',
            padding: '15px',
            background: '#fff',
            color: '#000',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Continue with Google
        </button>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginBottom: '25px',
      }}>
        <div style={{ flex: 1, height: '1px', background: colors.border }} />
        <span style={{ color: colors.textSecondary, fontSize: '0.9rem' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: colors.border }} />
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '15px',
            marginBottom: '12px',
            background: colors.bgPrimary,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            color: colors.textPrimary,
            fontSize: '1rem',
            boxSizing: 'border-box',
          }}
        />
        
        <div style={{ position: 'relative', marginBottom: mode === 'signup' ? '12px' : '20px' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '15px',
              paddingRight: '50px',
              background: colors.bgPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              color: colors.textPrimary,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '15px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        {mode === 'signup' && (
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: '15px',
              marginBottom: '20px',
              background: colors.bgPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              color: colors.textPrimary,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px',
            background: colors.accent,
            color: colors.bgPrimary,
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      {error && (
        <p style={{
          color: error.includes('Check your email') ? '#4a9c6d' : '#dc2626',
          marginTop: '15px',
          fontSize: '0.9rem',
          textAlign: 'center',
        }}>
          {error}
        </p>
      )}

      <button
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setConfirmPassword('')
        }}
        style={{
          marginTop: '15px',
          background: 'none',
          border: 'none',
          color: colors.accent,
          cursor: 'pointer',
          fontSize: '0.9rem',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
