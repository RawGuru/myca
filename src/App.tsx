import { useState, useEffect, createContext, useContext } from 'react'

// Configuration
const CONFIG = {
  SUPABASE_URL: 'https://ksramckuggspsqymcjpo.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_XEhCbV6tKr2cdeq50hIlbg_i370O2kg',
}

// Colors
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
  error: '#c94a4a',
}

// Supabase client
const supabase = {
  from(table: string) {
    return {
      async select() {
        const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?select=*`, {
          headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY },
        })
        return { data: await res.json(), error: null }
      },
      eq(column: string, value: any) {
        return {
          async select() {
            const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}?${column}=eq.${value}&select=*`, {
              headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY },
            })
            return { data: await res.json(), error: null }
          }
        }
      }
    }
  }
}

// Demo data
const demoGivers = [
  { id: '1', name: 'Maria Santos', tagline: "I listen without agenda. Sometimes that's all we need.", rate_per_30: 25, qualities_offered: ['Present', 'Warm', 'Patient'] },
  { id: '2', name: 'James Chen', tagline: 'Former monk. I hold space for whatever needs to surface.', rate_per_30: 40, qualities_offered: ['Calming', 'Present', 'Insightful'] },
  { id: '3', name: 'Aisha Johnson', tagline: "Grandmother energy. I see you, and you're doing better than you think.", rate_per_30: 20, qualities_offered: ['Warm', 'Honest', 'Encouraging'] },
]

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    background: colors.bgPrimary,
    color: colors.textPrimary,
    minHeight: '100vh',
    maxWidth: '430px',
    margin: '0 auto',
  },
  screen: {
    padding: '20px',
    paddingBottom: '100px',
    minHeight: '100vh',
  },
  btn: {
    padding: '18px 30px',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    background: colors.accent,
    color: colors.bgPrimary,
  },
  btnSecondary: {
    padding: '18px 30px',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: 500,
    cursor: 'pointer',
    background: 'transparent',
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    width: '100%',
  },
  input: {
    background: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    padding: '15px 18px',
    fontSize: '1rem',
    color: colors.textPrimary,
    width: '100%',
    boxSizing: 'border-box' as const,
    outline: 'none',
  },
  card: {
    background: colors.bgCard,
    border: `1px solid ${colors.border}`,
    borderRadius: '20px',
    padding: '20px',
    marginBottom: '20px',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    marginBottom: '30px',
  },
  backBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    color: colors.textPrimary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
  },
}

// Components
function Header({ title, onBack }: {
