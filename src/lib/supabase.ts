import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ksramckuggspsqymcjpo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcmFtY2t1Z2dzcHNxeW1janBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ3MzYwMDAsImV4cCI6MjA1MDMxMjAwMH0.XEhCbV6tKr2cdeq50hIlbg_i370O2kg'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
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
