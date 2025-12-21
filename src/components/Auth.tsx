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

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
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

  const handleSocialAuth = async (provider: 'google' | 'apple') => {
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
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: colors.bgPrimary,
      color: colors.textPrimary,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        background: colors.bgSecondary,
        padding: '40px',
        borderRadius: '20px',
        border: `1px solid ${colors.border}`,
      }}>
        <h2 style={{ marginBottom: '30px', fontFamily: 'Georgia, serif', fontSize: '2rem' }}>
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </h2>
        
        <div style={{ marginBottom: '30px' }}>
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
              marginBottom: '12px',
              fontWeight: 500,
            }}
          >
            Continue with Google
          </button>
          
          <button
            onClick={() => handleSocialAuth('apple')}
            style={{
              width: '100%',
              padding: '15px',
              background: '#000',
              color: '#fff',
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              fontSize: '1rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Continue with Apple
          </button>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
          marginBottom: '30px',
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
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          }}>
            {error}
          </p>
        )}

        <button
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          style={{
            marginTop: '20px',
            background: 'none',
            border: 'none',
            color: colors.accent,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
