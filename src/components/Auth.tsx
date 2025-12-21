// src/components/Auth.tsx
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
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

  return (
    <div style={{
      maxWidth: '400px',
      margin: '100px auto',
      padding: '40px',
      border: '1px solid #ddd',
      borderRadius: '8px'
    }}>
      <h2>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</h2>
      
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px'
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
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      {error && (
        <p style={{ color: error.includes('Check your email') ? '#059669' : '#dc2626', marginTop: '12px' }}>
          {error}
        </p>
      )}

      <button
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        style={{
          marginTop: '16px',
          background: 'none',
          border: 'none',
          color: '#0066cc',
          cursor: 'pointer',
          textDecoration: 'underline'
        }}
      >
        {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
