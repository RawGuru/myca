import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ksramckuggspsqymcjpo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcmFtY2t1Z2dzcHNxeW1janBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTMwODgsImV4cCI6MjA4MTgyOTA4OH0.CszijxFZU09QKH2aJbv6TjniWUJ1muJDnHXSe_u8DJc'

// Global 403 counter
export let forbidden403Count = 0

// Custom fetch wrapper to log 403 errors
const originalFetch = window.fetch
const interceptedFetch: typeof fetch = async (input, init) => {
  const response = await originalFetch(input, init)

  if (response.status === 403) {
    forbidden403Count++
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input))
    const method = init?.method || 'GET'
    console.error('🚨 403 FORBIDDEN - GLOBAL INTERCEPTOR', {
      method,
      url,
      status: response.status,
      statusText: response.statusText,
      totalCount: forbidden403Count
    })
  }

  return response
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: interceptedFetch
  }
})

export type Profile = {
  id: string
  email: string | null
  name: string | null
  bio: string | null
  tagline: string | null
  video_url: string | null
  rate_per_30: number
  qualities_offered: string[]
  is_giver: boolean
  available: boolean
  created_at: string
  updated_at: string
}
