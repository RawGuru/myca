// src/App.tsx
import { useAuth } from './hooks/useAuth'
import Auth from './components/Auth'

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return <div style={{ padding: '100px', textAlign: 'center' }}>Loading...</div>
  }

  if (!user) {
    return <Auth />
  }

  return (
    <div style={{ padding: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px' }}>
        <h1>MYCA</h1>
        <button
          onClick={signOut}
          style={{
            padding: '8px 16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: '100px' }}>
        <h2 style={{ fontSize: '48px', marginBottom: '40px' }}>
          Everyone needs to be seen. Everyone can give that.
        </h2>
        
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <button style={{
            padding: '20px 40px',
            fontSize: '20px',
            backgroundColor: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}>
            Find Presence
          </button>
          
          <button style={{
            padding: '20px 40px',
            fontSize: '20px',
            backgroundColor: '#fff',
            color: '#000',
            border: '2px solid #000',
            borderRadius: '8px',
            cursor: 'pointer'
          }}>
            Give Presence
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
