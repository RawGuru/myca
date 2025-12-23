// src/App.tsx
import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import Auth from './components/Auth'

const CONFIG = {
  SUPABASE_URL: 'https://ksramckuggspsqymcjpo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcmFtY2t1Z2dzcHNxeW1janBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTMwODgsImV4cCI6MjA4MTgyOTA4OH0.CszijxFZU09QKH2aJbv6TjniWUJ1muJDnHXSe_u8DJc',
}

const colors = {
  bgPrimary: '#0a0a0a',
  bgSecondary: '#141414',
  bgCard: '#1a1a1a',
  textPrimary: '#f5f5f5',
  textSecondary: '#a0a0a0',
  textMuted: '#666',
  accent: '#c9a66b',
  accentSoft: 'rgba(201, 166, 107, 0.15)',
  border: '#2a2a2a',
  success: '#4a9c6d',
}

const demoGivers = [
  { id: '1', name: 'Maria Santos', tagline: "I listen without agenda. Sometimes that's all we need.", rate_per_30: 25, qualities_offered: ['Present', 'Warm', 'Patient'] },
  { id: '2', name: 'James Chen', tagline: 'Former monk. I hold space for whatever needs to surface.', rate_per_30: 40, qualities_offered: ['Calming', 'Present', 'Insightful'] },
  { id: '3', name: 'Aisha Johnson', tagline: "Grandmother energy. I see you, and you're doing better than you think.", rate_per_30: 20, qualities_offered: ['Warm', 'Honest', 'Encouraging'] },
]

interface Giver {
  id: string
  name: string
  tagline: string
  rate_per_30: number
  qualities_offered: string[]
}

function App() {
  const { user, loading, signOut } = useAuth()
  const [screen, setScreen] = useState('welcome')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [returnToScreen, setReturnToScreen] = useState('')
  const [selectedGiver, setSelectedGiver] = useState<Giver | null>(null)
  const [givers, setGivers] = useState<Giver[]>(demoGivers)
  const [duration, setDuration] = useState(30)
  const [time, setTime] = useState('2:00 PM')

  useEffect(() => {
    fetch(`${CONFIG.SUPABASE_URL}/rest/v1/profiles?is_giver=eq.true&select=*`, {
      headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY },
    })
      .then(res => res.json())
      .then(data => { if (data?.length > 0) setGivers(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user && needsAuth && returnToScreen) {
      setNeedsAuth(false)
      setScreen(returnToScreen)
      setReturnToScreen('')
    }
  }, [user, needsAuth, returnToScreen])

  const requireAuth = (nextScreen: string) => {
    if (!user) {
      setReturnToScreen(nextScreen)
      setNeedsAuth(true)
    } else {
      setScreen(nextScreen)
    }
  }

  if (loading) {
    return (
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: colors.bgPrimary,
        color: colors.textPrimary,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        Loading...
      </div>
    )
  }

  if (needsAuth && !user) {
    return <Auth onBack={() => { setNeedsAuth(false); setReturnToScreen(''); }} />
  }

  const containerStyle: React.CSSProperties = {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: colors.bgPrimary,
    color: colors.textPrimary,
    minHeight: '100vh',
    maxWidth: '430px',
    margin: '0 auto',
  }

  const screenStyle: React.CSSProperties = {
    padding: '20px',
    paddingBottom: '100px',
    minHeight: '100vh',
  }

  const btnStyle: React.CSSProperties = {
    padding: '18px 30px',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    background: colors.accent,
    color: colors.bgPrimary,
    marginBottom: '15px',
  }

  const btnSecondaryStyle: React.CSSProperties = {
    ...btnStyle,
    background: 'transparent',
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
  }

  const cardStyle: React.CSSProperties = {
    background: colors.bgCard,
    border: `1px solid ${colors.border}`,
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '20px',
    cursor: 'pointer',
  }

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '430px',
    background: colors.bgSecondary,
    borderTop: `1px solid ${colors.border}`,
    padding: '15px 20px',
    display: 'flex',
    justifyContent: 'space-around',
  }

  const Nav = () => (
    <nav style={navStyle}>
      {[
        { id: 'browse', icon: '🔍', label: 'Find' },
        { id: 'giverIntro', icon: '🌱', label: 'Offer' },
        { id: 'sessions', icon: '📅', label: 'Sessions' },
      ].map(item => (
        <button
          key={item.id}
          onClick={() => setScreen(item.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '5px',
            color: screen === item.id || screen === 'giverCode' ? colors.accent : colors.textMuted,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '1.3rem' }}>{item.icon}</span>
          <span style={{ fontSize: '0.75rem' }}>{item.label}</span>
        </button>
      ))}
    </nav>
  )

  const SignOutButton = () => user ? (
    <button
      onClick={signOut}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        padding: '8px 16px',
        background: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '8px',
        color: colors.textPrimary,
        cursor: 'pointer',
        fontSize: '0.9rem',
      }}
    >
      Sign Out
    </button>
  ) : null

  if (screen === 'welcome') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
          <SignOutButton />
          
          <div style={{
            width: '80px',
            height: '80px',
            border: `2px solid ${colors.accent}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '30px',
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: `radial-gradient(circle, ${colors.accent} 0%, transparent 70%)`,
              borderRadius: '50%',
            }} />
          </div>
          <h1 style={{ fontSize: '3rem', marginBottom: '15px', fontFamily: 'Georgia, serif', fontWeight: 400 }}>Myca</h1>
          <p style={{ fontSize: '1.05rem', color: colors.textPrimary, maxWidth: '340px', lineHeight: 1.5, marginBottom: '50px' }}>
            People with a gift for presence. Prepared, grounded, and committed to the craft of being there.
          </p>
          <div style={{ width: '100%', maxWidth: '320px' }}>
            <button style={btnStyle} onClick={() => setScreen('browse')}>Find Presence</button>
            <button style={btnSecondaryStyle} onClick={() => setScreen('giverIntro')}>Offer Presence</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'browse') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button onClick={() => setScreen('welcome')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Find Presence</h2>
            <div style={{ width: '40px' }} />
          </div>
          
          {givers.map(giver => (
            <div key={giver.id} style={cardStyle} onClick={() => { setSelectedGiver(giver); setScreen('profile'); }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                <div style={{
                  width: '70px',
                  height: '70px',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${colors.accentSoft}, ${colors.bgSecondary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.5rem',
                  color: colors.accent,
                }}>
                  {giver.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '5px', fontFamily: 'Georgia, serif' }}>{giver.name}</h3>
                  <p style={{ fontSize: '0.9rem', color: colors.textSecondary }}>{giver.tagline}</p>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                {giver.qualities_offered.slice(0, 3).map((q, i) => (
                  <span key={q} style={{
                    padding: '6px 12px',
                    background: i < 2 ? colors.accentSoft : colors.bgSecondary,
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    color: i < 2 ? colors.accent : colors.textSecondary,
                    marginRight: '8px',
                  }}>
                    {q}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '15px', borderTop: `1px solid ${colors.border}` }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>${giver.rate_per_30} <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: '0.9rem' }}>/ 30 min</span></div>
                <div><span style={{ width: '10px', height: '10px', background: colors.success, borderRadius: '50%', display: 'inline-block', marginRight: '8px' }} />Available</div>
              </div>
            </div>
          ))}
          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'profile' && selectedGiver) {
    const durations = [{ min: 15, mult: 0.5 }, { min: 30, mult: 1 }, { min: 60, mult: 1.8 }]
    const times = ['9:00 AM', '10:30 AM', '2:00 PM', '4:00 PM', '6:30 PM']
    const price = Math.round(selectedGiver.rate_per_30 * (durations.find(d => d.min === duration)?.mult || 1))

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button onClick={() => setScreen('browse')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <div style={{ width: '40px' }} />
          </div>
          
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.accentSoft}, ${colors.bgSecondary})`,
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'Georgia, serif',
              fontSize: '2.5rem',
              color: colors.accent,
              border: `3px solid ${colors.accent}`,
            }}>
              {selectedGiver.name[0]}
            </div>
            <h1 style={{ fontSize: '2rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>{selectedGiver.name}</h1>
            <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>{selectedGiver.tagline}</p>
            <div style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.accent }}>${selectedGiver.rate_per_30} <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: '1rem' }}>/ 30 min</span></div>
          </div>

          <div style={{ ...cardStyle, cursor: 'default' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', fontFamily: 'Georgia, serif' }}>📅 Book a session</h3>
            
            <p style={{ color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Duration</p>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {durations.map(d => (
                <div
                  key={d.min}
                  onClick={() => setDuration(d.min)}
                  style={{
                    flex: 1,
                    padding: '15px',
                    background: duration === d.min ? colors.accentSoft : colors.bgSecondary,
                    border: `1px solid ${duration === d.min ? colors.accent : colors.border}`,
                    borderRadius: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{d.min}m</div>
                  <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>${Math.round(selectedGiver.rate_per_30 * d.mult)}</div>
                </div>
              ))}
            </div>

            <p style={{ color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Time</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {times.map(t => (
                <div
                  key={t}
                  onClick={() => setTime(t)}
                  style={{
                    padding: '12px',
                    background: time === t ? colors.accentSoft : colors.bgSecondary,
                    border: `1px solid ${time === t ? colors.accent : colors.border}`,
                    borderRadius: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    color: time === t ? colors.accent : colors.textPrimary,
                    fontSize: '0.9rem',
                  }}
                >
                  {t}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderTop: `1px solid ${colors.border}` }}>
              <span style={{ color: colors.textSecondary }}>Total</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 600 }}>${price}</span>
            </div>
            <button style={btnStyle} onClick={() => requireAuth('confirmation')}>Book Session</button>
          </div>
          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'confirmation') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{
            width: '100px',
            height: '100px',
            background: colors.accentSoft,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '30px',
            fontSize: '3rem',
            color: colors.accent,
          }}>✓</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Session Booked</h1>
          <p style={{ color: colors.textSecondary, marginBottom: '30px' }}>{selectedGiver?.name} will be ready for you.</p>
          <button style={{ ...btnStyle, maxWidth: '320px' }} onClick={() => setScreen('browse')}>Back to Browse</button>
        </div>
      </div>
    )
  }

  if (screen === 'giverIntro') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
          <SignOutButton />
          
          <div style={{
            width: '80px',
            height: '80px',
            border: `2px solid ${colors.accent}`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
          }}>
            <span style={{ fontSize: '2.5rem' }}>🌱</span>
          </div>
          
          <p style={{ fontSize: '1.1rem', color: colors.textPrimary, maxWidth: '340px', lineHeight: 1.6, marginBottom: '20px' }}>
            You might be the person others come to when they need to talk. The one who listens without making it about yourself. The one who stays steady.
          </p>
          
          <p style={{ fontSize: '1.1rem', color: colors.textPrimary, maxWidth: '340px', lineHeight: 1.6, marginBottom: '60px' }}>
            If that sounds like you, there's a place for you here.
          </p>

          <div style={{ width: '100%', maxWidth: '320px' }}>
            <button style={btnStyle} onClick={() => setScreen('giverCode')}>Tell me more</button>
            <button style={{ ...btnSecondaryStyle, marginBottom: 0 }} onClick={() => setScreen('welcome')}>Back</button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'giverCode') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button onClick={() => setScreen('giverIntro')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>The Giver Code</h2>
            <div style={{ width: '40px' }} />
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', fontFamily: 'Georgia, serif', color: colors.accent }}>
              What happens when you do this:
            </h3>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0' }}>
              Your own noise quiets. For this session, your life pauses. You get to witness someone's actual experience. You learn how other people carry what they carry. You discover that you don't need to fix anything to be valuable. You finish a little more connected and a little less stuck in your own loop.
            </p>
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', fontFamily: 'Georgia, serif', color: colors.accent }}>
              What makes that possible:
            </h3>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '12px' }}>
              You listen. Fully. Without planning what to say next.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '12px' }}>
              You stay steady. If they're overwhelmed, you remain grounded. They can feel that.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '12px' }}>
              You make it safe. Whatever they bring, you can hold it. They can say the thing they haven't said anywhere else.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '12px' }}>
              You reflect back what you hear. Their words. Their feeling. So they see themselves more clearly.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '12px' }}>
              You keep yourself out of the way. For this session, your needs stay outside the room.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0' }}>
              You let go when it ends. You show up fully, and when it's over, you release it. You serve their strength.
            </p>
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', fontFamily: 'Georgia, serif', color: colors.accent }}>
              What draws you to this?
            </h3>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '12px' }}>
              Some want the stillness it brings. Some want to learn from lives different than theirs. Some want to be reminded that presence itself has value. Some want to step outside themselves for an hour.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0' }}>
              Whatever your reason, that's the right one.
            </p>
          </div>

          {!user ? (
            <div style={{ marginTop: '-10px' }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px', fontFamily: 'Georgia, serif', textAlign: 'center' }}>Create your account</h3>
              <Auth onBack={() => setScreen('giverIntro')} />
            </div>
          ) : (
            <button style={btnStyle} onClick={() => setScreen('give')}>Create Profile</button>
          )}
          
          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'give') {
    if (!user) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
              <button onClick={() => setScreen('giverCode')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
              <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Create Account</h2>
              <div style={{ width: '40px' }} />
            </div>
            <Auth onBack={() => setScreen('giverCode')} />
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button onClick={() => setScreen('giverCode')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Create Profile</h2>
            <div style={{ width: '40px' }} />
          </div>
          <p style={{ color: colors.textSecondary, marginBottom: '30px' }}>Share your presence with those who need it.</p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Your name</label>
            <input style={{ width: '100%', padding: '15px', background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textPrimary, fontSize: '1rem', boxSizing: 'border-box' }} placeholder="How should people know you?" />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Your tagline</label>
            <input style={{ width: '100%', padding: '15px', background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textPrimary, fontSize: '1rem', boxSizing: 'border-box' }} placeholder="One sentence about your presence..." />
          </div>

          <button style={btnStyle} onClick={() => setScreen('giveConfirmation')}>Create Profile</button>
          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'giveConfirmation') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{
            width: '100px',
            height: '100px',
            background: colors.accentSoft,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '30px',
            fontSize: '3rem',
            color: colors.accent,
          }}>✓</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Profile Created</h1>
          <p style={{ color: colors.textSecondary, marginBottom: '30px' }}>You're now visible to people seeking presence.</p>
          <button style={{ ...btnStyle, maxWidth: '320px' }} onClick={() => setScreen('browse')}>See Other Givers</button>
        </div>
      </div>
    )
  }

  if (screen === 'sessions') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />
          
          <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif', textAlign: 'center', marginBottom: '30px' }}>Your Sessions</h2>
          <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.textMuted }}>
            <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📅</div>
            <p>No sessions yet</p>
            <button style={{ ...btnStyle, marginTop: '30px', maxWidth: '200px' }} onClick={() => setScreen('browse')}>Find Someone</button>
          </div>
          <Nav />
        </div>
      </div>
    )
  }

  return null
}

export default App
