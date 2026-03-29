// src/App.tsx
import React, { useState, useEffect, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react'
import { useAuth } from './hooks/useAuth'
import { supabase, forbidden403Count } from './lib/supabase'
import DailyIframe, { DailyCall } from '@daily-co/daily-js'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import Auth from './components/Auth'
import { SessionStateMachine } from './SessionStateMachine'
import { ReceiverInitiatedExtension } from './components/session/ReceiverInitiatedExtension'

// Video session wrapper to track mount/unmount
function VideoSessionWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    const mountTime = new Date().toISOString()
    console.log('========================================')
    console.log('VIDEO SESSION WRAPPER: Component MOUNTED at', mountTime)
    console.log('========================================')

    return () => {
      const unmountTime = new Date().toISOString()
      console.log('========================================')
      console.log('VIDEO SESSION WRAPPER: Component UNMOUNTING at', unmountTime)
      console.log('========================================')
    }
  }, [])

  return <>{children}</>
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      const colors = {
        bgPrimary: '#0a0a0a',
        bgSecondary: '#1a1a1a',
        textPrimary: '#f5f5f5',
        textMuted: '#888',
        border: '#333',
        accent: '#c9a66b'
      }

      return (
        <div style={{
          minHeight: '100vh',
          background: colors.bgPrimary,
          color: colors.textPrimary,
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '40px 20px'
          }}>
            <h1 style={{
              fontSize: typography.xl,
              fontWeight: 700,
              marginBottom: spacing.lg,
              color: '#ef4444'
            }}>
              Email Events crashed
            </h1>

            <div style={{
              padding: spacing.lg,
              marginBottom: spacing.lg,
              background: colors.bgSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: '3px'
            }}>
              <div style={{ marginBottom: spacing.sm }}>
                <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
              </div>

              <details style={{ marginTop: spacing.lg }}>
                <summary style={{
                  cursor: 'pointer',
                  color: colors.accent,
                  marginBottom: spacing.sm
                }}>
                  Show component stack
                </summary>
                <pre style={{
                  background: colors.bgPrimary,
                  padding: spacing.md,
                  borderRadius: '3px',
                  overflow: 'auto',
                  fontSize: typography.sm,
                  lineHeight: 1.4
                }}>
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            </div>

            <button
              onClick={() => {
                window.location.hash = '#/sessions'
                window.location.reload()
              }}
              style={{
                padding: `${spacing.sm} ${spacing.xl}`,
                background: colors.accent,
                border: 'none',
                borderRadius: '3px',
                color: colors.bgPrimary,
                fontSize: typography.md,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Back to Sessions
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const SUPABASE_URL = 'https://ksramckuggspsqymcjpo.supabase.co'

// Initialize Stripe (Phase 7: Real Stripe Integration)
// TODO: Replace with your actual Stripe publishable key
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'
let stripePromise: Promise<Stripe | null> | null = null
const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY)
  }
  return stripePromise
}

// Mode types
type Mode = 'vault' | 'mirror' | 'strategist' | 'teacher' | 'challenger' | 'vibe_check'

// Category types
type Category = 'health' | 'relationships' | 'creativity' | 'career_money' | 'life_transitions' | 'spirituality' | 'general'

// Listing type (new multi-listing architecture)
export interface Listing {
  id: string
  user_id: string
  topic: string
  mode: Mode
  price_cents: number
  description: string | null
  specific_topics?: string | null
  is_active: boolean
  requires_approval?: boolean        // Booking requires giver approval (default true)
  allow_instant_book?: boolean       // Allow instant booking without approval
  directions_allowed?: string[]      // Pre-consented direction types
  boundaries?: string | null         // Giver boundaries and safety guidelines
  created_at: string
  updated_at: string
  categories?: Category[]
  profiles?: {
    id: string
    name: string
    tagline: string | null
    bio: string | null
    video_url: string | null
    qualities_offered: string[]
    twitter_handle: string | null
    instagram_handle: string | null
    linkedin_handle: string | null
    available?: boolean
    total_sessions_completed?: number
    profile_picture_url?: string | null
  }
}

// Extension type
export interface Extension {
  id: string
  booking_id: string
  extended_at: string
  amount_cents: number
  stripe_payment_intent_id: string | null
  giver_confirmed: boolean
  seeker_confirmed: boolean
  created_at: string
}

// Feedback type
export interface Feedback {
  id: string
  booking_id: string
  seeker_id: string
  giver_id: string
  would_book_again: boolean | null
  matched_mode: boolean | null
  created_at: string
}

// Booking type (matches actual Supabase schema)
interface Booking {
  id: string
  seeker_id: string
  giver_id: string
  scheduled_time: string
  duration_minutes: number
  amount_cents: number // Gross amount (what receiver pays)
  status: 'pending' | 'pending_approval' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  session_intention?: string | null
  stripe_payment_id: string | null
  video_room_url: string | null
  created_at?: string
  giver_joined_at?: string | null
  seeker_credit_earned?: boolean | null
  started_at?: string | null
  ended_at?: string | null
  elapsed_seconds?: number | null
  end_reason?: string | null
  payout_net_cents?: number | null
  refund_gross_cents?: number | null
  payout_status?: string | null
}

const colors = {
  bgPrimary: '#060606',
  bgSecondary: '#0B0B0C',
  bgCard: '#111214',
  textPrimary: '#F4F1EA',
  textSecondary: 'rgba(244, 241, 234, 0.72)',
  textMuted: 'rgba(244, 241, 234, 0.48)',
  accent: '#C8AE6A',
  accentHover: '#D7BE7D',
  accentSoft: 'rgba(200, 174, 106, 0.1)',
  border: 'rgba(255,255,255,0.08)',
  borderEmphasis: 'rgba(200,174,106,0.35)',
  success: '#C8AE6A',
  error: '#d9534f',
}

// Typography scale (6-step system)
const typography = {
  xs: '0.75rem',    // 12px - captions, footnotes
  sm: '0.85rem',    // 13.6px - secondary text, labels
  base: '0.95rem',  // 15.2px - body text, buttons
  md: '1rem',       // 16px - primary body
  lg: '1.2rem',     // 19.2px - subheadings
  xl: '1.5rem',     // 24px - page headings
}

// Spacing scale (4px base unit)
const spacing = {
  xs: '8px',    // 2x
  sm: '12px',   // 3x
  md: '16px',   // 4x
  lg: '20px',   // 5x
  xl: '24px',   // 6x
  xxl: '32px',  // 8x
}

// Border radius scale
const radius = {
  button: '14px',
  card: '20px',
  panel: '24px',
  pill: '999px',
}

// Calendar-based availability: specific date + time
interface AvailabilitySlot {
  id: string
  giver_id: string
  date: string // YYYY-MM-DD
  time: string // HH:MM
  is_booked: boolean
  created_at: string
}

interface Giver {
  id: string
  name: string
  tagline: string | null
  rate_per_30?: number  // Optional - deprecated in multi-listing architecture
  qualities_offered?: string[]
  bio?: string | null
  video_url?: string | null
  available?: boolean
  is_giver?: boolean
  stripe_account_id?: string | null
  stripe_onboarding_complete?: boolean
  timezone?: string
  total_sessions_completed?: number
  times_joined_late?: number
  listings?: Listing[] // Multi-listing architecture
  twitter_handle?: string | null
  instagram_handle?: string | null
  linkedin_handle?: string | null
  profile_picture_url?: string | null
  giver_availability?: Array<{ date: string; time: string; is_booked: boolean }> | null
}

interface UserProfile {
  id: string
  timezone: string
  created_at: string
  updated_at: string
}

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

// Modes of interaction
export const MODES: { value: Mode; label: string; description: string }[] = [
  { value: 'vault', label: 'Pure listening. No advice given.', description: '' },
  { value: 'mirror', label: 'Reflective listening. Help them see themselves.', description: '' },
  { value: 'strategist', label: 'Brainstorming and problem-solving together.', description: '' },
  { value: 'teacher', label: 'Instruction, demonstration, skill transfer.', description: '' },
  { value: 'challenger', label: 'Debate, pushback, stress-testing ideas.', description: '' },
  { value: 'vibe_check', label: 'Casual conversation. No agenda.', description: '' },
]

// Categories for listings
export const CATEGORIES: { value: Category; label: string; examples: string }[] = [
  { value: 'health', label: 'Health & Wellness', examples: 'Fitness, nutrition, mental health, sleep' },
  { value: 'relationships', label: 'Relationships', examples: 'Dating, family, friendships, boundaries' },
  { value: 'creativity', label: 'Creativity', examples: 'Writing, music, art, creative blocks' },
  { value: 'career_money', label: 'Career & Money', examples: 'Job search, entrepreneurship, investing, salary negotiation' },
  { value: 'life_transitions', label: 'Life Transitions', examples: 'Moving, career change, breakups, parenthood' },
  { value: 'spirituality', label: 'Spirituality', examples: 'Meditation, faith, purpose, meaning' },
  { value: 'general', label: 'General / Open', examples: 'Whatever\'s on your mind' },
]

// Time physics constants
export const BLOCK_MINUTES = 25  // Canonical block duration for all UI
export const ACTIVE_MINUTES_PER_BLOCK = 25
export const BUFFER_MINUTES = 5
export const TOTAL_BLOCK_MINUTES = 30

// ============================================
// Reusable ImageUpload Component
// ============================================

interface ImageUploadProps {
  onUpload: (publicUrl: string) => Promise<void>
  currentImageUrl?: string
  bucketName: string
  maxSizeMB: number
  aspectRatio?: 'circle' | 'square' | 'wide'
  initials?: string
  buttonText?: string
}

function ImageUpload({
  onUpload,
  currentImageUrl,
  bucketName,
  maxSizeMB,
  aspectRatio = 'circle',
  initials = '?',
  buttonText
}: ImageUploadProps) {
  const { user } = useAuth()
  const uploadId = `image-upload-${bucketName}-${Date.now()}`

  // Local preview state - shows preview immediately after file selection
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
      }
    }
  }, [localPreviewUrl])

  const buttonStyle: React.CSSProperties = {
    padding: `${spacing.sm} ${spacing.xl}`,
    borderRadius: '3px',
    border: `1px solid ${colors.border}`,
    fontSize: typography.md,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'transparent',
    color: colors.textPrimary,
  }

  const handleFileUpload = async (file: File) => {
    console.log('🔄 Starting image upload process...')

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`Image must be less than ${maxSizeMB}MB`)
      return
    }

    // Create local preview immediately
    const blobUrl = URL.createObjectURL(file)
    setLocalPreviewUrl(blobUrl)
    console.log('🖼️ Local preview created:', blobUrl)

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      console.log('📝 Generated filename:', fileName)

      // Upload to Supabase Storage
      console.log(`☁️ Uploading to Supabase storage bucket: ${bucketName}`)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('❌ Upload error:', uploadError)
        throw uploadError
      }
      console.log('✅ Upload successful:', uploadData)

      // Get public URL
      console.log('🔗 Getting public URL...')
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl
      console.log('✅ Public URL:', publicUrl)

      // Call onUpload callback and wait for parent state to update
      console.log('💾 Calling onUpload callback...')
      await onUpload(publicUrl)
      console.log('✅ onUpload callback complete')

      // Small delay to ensure parent component has re-rendered with new currentImageUrl
      await new Promise(resolve => setTimeout(resolve, 100))

      // Clean up local blob URL after server URL is available and parent state updated
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
        setLocalPreviewUrl(null)
      }
      console.log('✅ Image upload complete!')

      alert('Image uploaded successfully!')
    } catch (err) {
      console.error('❌ ERROR in image upload:', err)

      // Clean up local preview on error
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl)
        setLocalPreviewUrl(null)
      }

      alert(`Failed to upload image: ${err instanceof Error ? err.message : 'Please try again'}`)
    }
  }

  // Preview dimensions based on aspect ratio
  const previewStyle = {
    circle: { width: '80px', height: '80px', borderRadius: '50%' },
    square: { width: '120px', height: '120px', borderRadius: '3px' },
    wide: { width: '200px', height: '112px', borderRadius: '3px' }
  }[aspectRatio]

  return (
    <div
      style={{
        border: `2px dashed ${colors.border}`,
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        transition: 'all 0.2s',
        background: colors.bgSecondary
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        console.log('🎯 Drag over detected')
        e.currentTarget.style.borderColor = colors.accent
        e.currentTarget.style.background = colors.accentSoft
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        // Only reset styles if actually leaving the drop zone (not entering a child element)
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX
        const y = e.clientY
        if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
          console.log('🚫 Drag leave detected (actually left zone)')
          e.currentTarget.style.borderColor = colors.border
          e.currentTarget.style.background = colors.bgSecondary
        }
      }}
      onDrop={async (e) => {
        e.preventDefault()
        e.stopPropagation()
        console.log('📁 Drop detected!', e.dataTransfer.files)
        e.currentTarget.style.borderColor = colors.border
        e.currentTarget.style.background = colors.bgSecondary

        const file = e.dataTransfer.files?.[0]
        if (!file) {
          console.log('❌ No file found in drop')
          return
        }
        console.log('✅ File found:', file.name, file.type, `${(file.size / 1024 / 1024).toFixed(2)}MB`)

        await handleFileUpload(file)
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', pointerEvents: 'none' }}>
        {/* Image Preview - shows local preview or server URL */}
        {(localPreviewUrl || currentImageUrl) ? (
          <div style={{
            ...previewStyle,
            backgroundImage: `url(${localPreviewUrl || currentImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            border: `2px solid ${colors.accent}`
          }} />
        ) : (
          <div style={{
            ...previewStyle,
            background: colors.accentSoft,
            border: `2px solid ${colors.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 600,
            color: colors.accent
          }}>
            {initials}
          </div>
        )}

        {/* Upload Controls */}
        <div>
          <input
            type="file"
            id={uploadId}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return

              await handleFileUpload(file)

              // Reset input
              e.target.value = ''
            }}
          />
          <button
            style={{ ...buttonStyle, margin: 0, pointerEvents: 'auto' }}
            onClick={() => document.getElementById(uploadId)?.click()}
          >
            {buttonText || (currentImageUrl ? 'Change Photo' : 'Upload Photo')}
          </button>
          <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginTop: '10px' }}>
            or drag and drop
          </p>
          <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '5px' }}>
            Max {maxSizeMB}MB • JPG, PNG, or GIF
          </p>
          <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: '5px', fontStyle: 'italic' }}>
            Square image works best. Face visible. Good lighting.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Reusable VideoUpload Component
// ============================================

interface VideoUploadProps {
  onUpload: (publicUrl: string) => Promise<void>
  currentVideoUrl?: string
  bucketName: string
  maxSizeMB: number
  minDurationSeconds?: number
  maxDurationSeconds?: number
  buttonText?: string
}

// @ts-expect-error - VideoUpload component kept for potential future use
function VideoUpload({
  onUpload,
  currentVideoUrl,
  bucketName,
  maxSizeMB,
  minDurationSeconds,
  maxDurationSeconds,
}: VideoUploadProps) {
  const { user } = useAuth()
  const uploadId = `video-upload-${bucketName}-${Date.now()}`
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null)
  const liveVideoRef = useRef<HTMLVideoElement>(null)
  const videoPreviewRef = useRef<HTMLVideoElement>(null)

  const buttonStyle: React.CSSProperties = {
    padding: `${spacing.sm} ${spacing.xl}`,
    borderRadius: '3px',
    border: `1px solid ${colors.border}`,
    fontSize: typography.md,
    fontWeight: 600,
    cursor: (uploading || isRecording) ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    background: 'transparent',
    color: colors.textPrimary,
    opacity: (uploading || isRecording) ? 0.6 : 1,
  }

  const handleFileUpload = async (file: File) => {
    console.log('🔄 Starting video upload process...')
    setUploading(true)
    setUploadError(null)

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setUploadError('Please select a video file')
      setUploading(false)
      return
    }

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setUploadError(`Video must be less than ${maxSizeMB}MB`)
      setUploading(false)
      return
    }

    // Create temporary URL to check duration
    const tempUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.src = tempUrl

    video.onloadedmetadata = async () => {
      const duration = video.duration
      console.log('📹 Video duration:', duration, 'seconds')

      // Validate duration if specified
      if (minDurationSeconds !== undefined && maxDurationSeconds !== undefined) {
        if (duration < minDurationSeconds || duration > maxDurationSeconds) {
          const targetDuration = Math.round((minDurationSeconds + maxDurationSeconds) / 2)
          setUploadError(`Video must be ${targetDuration} seconds (${minDurationSeconds}-${maxDurationSeconds} allowed)`)
          URL.revokeObjectURL(tempUrl)
          setUploading(false)
          return
        }
      }

      try {
        // Create unique filename
        const fileExt = file.name.split('.').pop()
        const fileName = `${user?.id}-${Date.now()}.${fileExt}`
        console.log('📝 Generated filename:', fileName)

        // Upload to Supabase Storage
        console.log(`☁️ Uploading to Supabase storage bucket: ${bucketName}`)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('❌ Upload error:', uploadError)
          throw uploadError
        }
        console.log('✅ Upload successful:', uploadData)

        // Get public URL
        console.log('🔗 Getting public URL...')
        const { data: urlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(fileName)

        const publicUrl = urlData.publicUrl
        console.log('✅ Public URL:', publicUrl)

        // Call onUpload callback
        console.log('💾 Calling onUpload callback...')
        await onUpload(publicUrl)
        console.log('✅ Video upload complete!')
      } catch (err) {
        console.error('❌ ERROR in video upload:', err)
        setUploadError(`Failed to upload video: ${err instanceof Error ? err.message : 'Please try again'}`)
      } finally {
        URL.revokeObjectURL(tempUrl)
        setUploading(false)
      }
    }
  }

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        setRecordedBlob(blob)
        setRecordedUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(track => track.stop())
        setLiveStream(null)
      }

      // Attach live stream to video preview
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
        liveVideoRef.current.play()
      }

      setLiveStream(stream)
      setMediaRecorder(recorder)
      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
    } catch (err) {
      setUploadError('Camera access denied. Please allow camera access to record.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const uploadRecording = async () => {
    if (!recordedBlob || !user) return

    setUploading(true)
    try {
      const fileName = `${user.id}-${Date.now()}.webm`
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, recordedBlob, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) throw error

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName)

      await onUpload(urlData.publicUrl)
      setRecordedBlob(null)
      setRecordedUrl(null)
    } catch (err) {
      setUploadError(`Failed to upload: ${err instanceof Error ? err.message : 'Please try again'}`)
    } finally {
      setUploading(false)
    }
  }

  // Recording timer
  // Cleanup stream on unmount
  React.useEffect(() => {
    return () => {
      if (liveStream) {
        liveStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [liveStream])

  // Timer for recording duration
  React.useEffect(() => {
    let interval: number
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => {
          if (maxDurationSeconds && prev >= maxDurationSeconds) {
            stopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording, maxDurationSeconds])

  return (
    <div
      style={{
        border: `2px dashed ${isDragOver ? colors.accent : colors.border}`,
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        transition: 'all 0.2s',
        background: isDragOver ? colors.accentSoft : colors.bgSecondary,
        cursor: (uploading || isRecording) ? 'not-allowed' : 'default'
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (!uploading) {
          console.log('🎯 Drag over detected')
          setIsDragOver(true)
        }
      }}
      onDragLeave={() => {
        console.log('🚫 Drag leave detected')
        setIsDragOver(false)
      }}
      onDrop={async (e) => {
        e.preventDefault()
        setIsDragOver(false)

        if (uploading) return

        console.log('📁 Drop detected!', e.dataTransfer.files)

        const file = e.dataTransfer.files?.[0]
        if (!file) {
          console.log('❌ No file found in drop')
          return
        }
        console.log('✅ File found:', file.name, file.type, `${(file.size / 1024 / 1024).toFixed(2)}MB`)

        await handleFileUpload(file)
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
        {/* Live Recording Preview */}
        {isRecording && (
          <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                borderRadius: '3px',
                border: `2px solid ${colors.accent}`,
                transform: 'scaleX(-1)' // Mirror effect for natural preview
              }}
            />
            {/* Recording Indicators Overlay */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '8px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '1rem', color: '#ff0000', animation: 'pulse 1.5s infinite' }}>●</span>
              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>Recording... {recordingTime}s</span>
            </div>
          </div>
        )}

        {/* Video Preview (after recording) */}
        {(currentVideoUrl || recordedUrl) && !isRecording && (
          <video
            ref={videoPreviewRef}
            src={recordedUrl || currentVideoUrl}
            controls
            style={{
              width: '100%',
              maxWidth: '300px',
              borderRadius: '3px',
              border: `2px solid ${colors.accent}`
            }}
          />
        )}

        {/* Recording Preview */}
        {recordedUrl && !currentVideoUrl && (
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
            <button
              style={{ ...buttonStyle, margin: 0, background: colors.accent, color: '#000', border: 'none' }}
              onClick={uploadRecording}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Use This Video'}
            </button>
            <button
              style={{ ...buttonStyle, margin: 0 }}
              onClick={() => {
                setRecordedBlob(null)
                setRecordedUrl(null)
                setRecordingTime(0)
              }}
              disabled={uploading}
            >
              Re-record
            </button>
          </div>
        )}

        {/* Recording UI */}
        {!recordedUrl && !currentVideoUrl && (
          <div style={{ marginBottom: '10px' }}>
            {isRecording ? (
              <>
                <button
                  style={{
                    ...buttonStyle,
                    margin: 0,
                    background: (minDurationSeconds && recordingTime < minDurationSeconds) ? colors.border : colors.error,
                    color: '#fff',
                    border: 'none',
                    cursor: (minDurationSeconds && recordingTime < minDurationSeconds) ? 'not-allowed' : 'pointer',
                    opacity: (minDurationSeconds && recordingTime < minDurationSeconds) ? 0.5 : 1
                  }}
                  onClick={stopRecording}
                  disabled={minDurationSeconds !== undefined && recordingTime < minDurationSeconds}
                >
                  ⏹ Stop Recording
                </button>
                {minDurationSeconds !== undefined && recordingTime < minDurationSeconds && (
                  <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '8px' }}>
                    Keep recording... {minDurationSeconds - recordingTime}s until minimum
                  </p>
                )}
              </>
            ) : (
              <button
                style={{ ...buttonStyle, margin: 0, background: colors.accent, color: '#000', border: 'none' }}
                onClick={startRecording}
              >
                🎥 Record video
              </button>
            )}
            {minDurationSeconds !== undefined && maxDurationSeconds !== undefined && !isRecording && (
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '8px' }}>
                Record {minDurationSeconds}-{maxDurationSeconds} seconds
              </p>
            )}
          </div>
        )}

        {/* Upload Controls */}
        {!isRecording && !recordedUrl && (
          <div>
            <p style={{ color: colors.textMuted, fontSize: '0.9rem', marginBottom: '10px' }}>
              or upload a video
            </p>
          <input
            type="file"
            id={uploadId}
            accept="video/*"
            style={{ display: 'none' }}
            disabled={uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return

              await handleFileUpload(file)

              // Reset input
              e.target.value = ''
            }}
          />
            <button
              style={{ ...buttonStyle, margin: 0 }}
              onClick={() => document.getElementById(uploadId)?.click()}
              disabled={uploading || isRecording}
            >
              {uploading ? 'Uploading...' : 'Choose File'}
            </button>
            <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginTop: '10px' }}>
              {uploading ? 'Processing video...' : 'or drag and drop'}
            </p>
            {!uploading && (
              <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '5px' }}>
                Max {maxSizeMB}MB
                {minDurationSeconds !== undefined && maxDurationSeconds !== undefined && (
                  <> • {Math.round((minDurationSeconds + maxDurationSeconds) / 2)} seconds ({minDurationSeconds}-{maxDurationSeconds} allowed)</>
                )}
              </p>
            )}
            {uploadError && (
              <p style={{ color: colors.error, fontSize: '0.9rem', marginTop: '10px', fontWeight: 500 }}>
                {uploadError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()
  const [screen, setScreen] = useState('welcome')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [returnToScreen, setReturnToScreen] = useState('')
  const [selectedGiver, setSelectedGiver] = useState<Giver | null>(null)
  const [givers, setGivers] = useState<Giver[]>([])
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date | null>(null)
  const [selectedBookingTime, setSelectedBookingTime] = useState<string>('')
  const [selectedListingForBooking, setSelectedListingForBooking] = useState<Listing | null>(null)
  const [blocksBooked] = useState<1>(1) // Single 30-min block only, extensions happen in-session
  const [sessionIntention] = useState<string>('') // TODO: Add UI for receiver to enter intention

  // Booking/payment state
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')

  // Credits state
  const [availableCredits, setAvailableCredits] = useState<any[]>([])
  const [totalCreditsCents, setTotalCreditsCents] = useState(0)
  const [creditsAppliedCents, setCreditsAppliedCents] = useState(0)

  // Stripe Connect state (for givers)
  const [myGiverProfile, setMyGiverProfile] = useState<Giver | null>(null)
  const [stripeConnectLoading, setStripeConnectLoading] = useState(false)
  const [stripeConnectError, setStripeConnectError] = useState('')

  // Video session state
  const [activeSession, setActiveSession] = useState<Booking | null>(null)
  const [_sessionTimeRemaining, setSessionTimeRemaining] = useState(30 * 60) // 30 minutes in seconds (internal only, not displayed)
  const [_showTimeWarning, setShowTimeWarning] = useState(false) // Internal state, not displayed per constitution
  const [showCountdown, setShowCountdown] = useState(false) // 30-second countdown overlay (Phase 5)
  const [dailyMeetingJoined, setDailyMeetingJoined] = useState(false) // Track if user completed Daily prejoin and joined meeting
  const [isFinalizingSession, setIsFinalizingSession] = useState(false) // Track if session is being finalized
  const [userBookings, setUserBookings] = useState<Booking[]>([])
  const [bookingsFetchError, setBookingsFetchError] = useState<{ code: string; message: string } | null>(null)
  const [emailEvents, setEmailEvents] = useState<any[]>([])
  const [emailEventsFilter, setEmailEventsFilter] = useState('')
  const [emailEventsLoading, setEmailEventsLoading] = useState(false)
  const [emailEventsError, setEmailEventsError] = useState<string | null>(null)
  const [stripeState, setStripeState] = useState<{ hasStripeAccountId: boolean; onboardingComplete: boolean; isGiver: boolean } | null>(null)
  const [_showGiverOverlay, setShowGiverOverlay] = useState(false) // Old overlay system (setter still used, to be removed)
  const [_extensionTimeRemaining, setExtensionTimeRemaining] = useState(60) // Old extension UI (setter still used, to be removed)

  // Feedback system state (Phase 8)
  const [feedbackBooking, setFeedbackBooking] = useState<Booking | null>(null)
  const [wouldBookAgain, setWouldBookAgain] = useState<boolean | null>(null)
  const [matchedMode, setMatchedMode] = useState<boolean | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  const dailyCallRef = useRef<DailyCall | null>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const stripeReturnHandledRef = useRef(false)
  const isFinalizingRef = useRef(false) // Guard against duplicate finalization calls

  // Giver profile form state
  const [giverName, setGiverName] = useState('')
  const [giverTagline, setGiverTagline] = useState('')
  const [giverRate, setGiverRate] = useState(15)
  const [giverTimezone, setGiverTimezone] = useState('America/New_York')
  const [giverBio, setGiverBio] = useState('')
  const [giverQualities, setGiverQualities] = useState<string[]>([])
  const [twitterHandle, setTwitterHandle] = useState('')
  const [instagramHandle, setInstagramHandle] = useState('')
  const [linkedinHandle, setLinkedinHandle] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Receiver profile form state (minimal)
  const [receiverName, setReceiverName] = useState('')
  const [receiverTagline, setReceiverTagline] = useState('')
  const [receiverProfilePictureUrl, setReceiverProfilePictureUrl] = useState<string | undefined>(undefined)

  // Age verification state
  const [ageVerified, setAgeVerified] = useState(false)

  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // Video recording state
  const [videoStep, setVideoStep] = useState<'prompt' | 'recording' | 'preview' | 'done'>('done')
  const [videoJustSaved, setVideoJustSaved] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [videoError, setVideoError] = useState('')

  // Calendar-based availability state
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([])
  const [newSlotDate, setNewSlotDate] = useState('')
  const [newSlotTime, setNewSlotTime] = useState('9:00')
  const [selectedGiverSlots, setSelectedGiverSlots] = useState<AvailabilitySlot[]>([])

  // Bulk availability state
  const [bulkStartTime, setBulkStartTime] = useState('9:00')
  const [bulkEndTime, setBulkEndTime] = useState('17:00')
  const [bulkSelectedDays, setBulkSelectedDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5])) // Mon-Fri default
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().split('T')[0])
  const [bulkEndDate, setBulkEndDate] = useState(() => {
    const weekFromNow = new Date()
    weekFromNow.setDate(weekFromNow.getDate() + 6)
    return weekFromNow.toISOString().split('T')[0]
  })

  // Saved givers state (private saves for seekers)
  const [savedGiverIds, setSavedGiverIds] = useState<Set<string>>(new Set())
  const [showSavedOnly, setShowSavedOnly] = useState(false)

  // Listing management state (multi-listing architecture)
  const [myListings, setMyListings] = useState<Listing[]>([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  const [listingFormData, setListingFormData] = useState({
    topic: '',
    mode: 'mirror' as Mode,
    price_cents: 2500,
    description: '',
    selectedCategories: [] as Category[],
    requires_approval: true as boolean,
    allow_instant_book: false as boolean,
    directions_allowed: ['go_deeper', 'hear_perspective', 'think_together', 'build_next_step'] as string[],
    boundaries: '' as string
  })
  const [listingFormError, setListingFormError] = useState<string | null>(null)

  // Seeker discovery flow state (Part 5)
  const [discoveryStep, setDiscoveryStep] = useState<'attention' | 'category' | 'availability' | 'feed'>('attention')
  const [discoveryFilters, setDiscoveryFilters] = useState({
    attentionType: null as Mode | null,
    category: null as Category | null,
    availability: null as 'now' | 'today' | 'week' | 'anytime' | null
  })
  const [filteredListings, setFilteredListings] = useState<Listing[]>([])
  const [currentFeedIndex, setCurrentFeedIndex] = useState(0)

  // Ensure user profile exists before giver operations
  const ensureProfileExists = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      // Check if profile exists
      const { data: existing, error: fetchError } = await supabase
        .from('profiles_public')
        .select('id, is_giver')
        .eq('id', user.id)
        .maybeSingle()

      if (fetchError) throw fetchError

      if (!existing) {
        // Create profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            is_giver: true,
            created_at: new Date().toISOString()
          })

        if (insertError) {
          console.error('Profile insert error:', insertError)
          // Parse error to provide helpful message
          const errMsg = insertError.message || ''
          if (errMsg.includes('display_name') || errMsg.includes('name')) {
            return { success: false, error: 'Please complete your profile with a name before creating an offer' }
          } else if (errMsg.includes('null value')) {
            return { success: false, error: 'Profile is missing required information. Please contact support.' }
          }
          return { success: false, error: 'Failed to create profile. Please try again.' }
        }
      } else if (!existing.is_giver) {
        // Update to mark as giver
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ is_giver: true })
          .eq('id', user.id)

        if (updateError) {
          console.error('Profile update error:', updateError)
          return { success: false, error: 'Failed to update profile. Please try again.' }
        }
      }

      return { success: true }
    } catch (err) {
      console.error('Error ensuring profile exists:', err)
      return { success: false, error: 'Unexpected error creating profile. Please try again.' }
    }
  }

  // Add availability slot (specific date + time)
  const addAvailabilitySlot = async () => {
    if (!newSlotDate || !newSlotTime || !user) return

    try {
      // Ensure profile exists first
      const profileResult = await ensureProfileExists()
      if (!profileResult.success) {
        console.error('Profile error:', profileResult.error)
        return
      }

      const { data, error } = await supabase
        .from('giver_availability')
        .insert({
          giver_id: user.id,
          date: newSlotDate,
          time: newSlotTime,
          is_booked: false
        })
        .select()
        .single()

      if (error) {
        // Error code 23505 = unique_violation (duplicate slot)
        if (error.code === '23505') {
          alert('This time slot already exists in your availability.')
        } else {
          throw error
        }
        return
      }

      setAvailabilitySlots(prev => [...prev, data])
      setNewSlotDate('')
      setNewSlotTime('9:00')
    } catch (err) {
      console.error('Error adding availability slot:', err)
      alert('Error adding availability slot. Please try again.')
    }
  }

  // Remove availability slot
  const removeAvailabilitySlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('giver_availability')
        .delete()
        .eq('id', slotId)

      if (error) throw error

      setAvailabilitySlots(prev => prev.filter(slot => slot.id !== slotId))
    } catch (err) {
      console.error('Error removing availability slot:', err)
    }
  }

  // Add bulk availability slots
  const addBulkAvailabilitySlots = async () => {
    if (!user || bulkSelectedDays.size === 0) return

    try {
      // Ensure profile exists first
      const profileResult = await ensureProfileExists()
      if (!profileResult.success) {
        console.error('Profile error:', profileResult.error)
        return
      }

      // Validate dates
      const startDate = new Date(bulkStartDate + 'T00:00:00')
      const endDate = new Date(bulkEndDate + 'T00:00:00')

      if (startDate > endDate) {
        alert('End date must be after start date')
        return
      }

      // Generate time slots between start and end time
      const [startHours, startMinutes] = bulkStartTime.split(':').map(Number)
      const [endHours, endMinutes] = bulkEndTime.split(':').map(Number)
      const startTotalMinutes = startHours * 60 + startMinutes
      const endTotalMinutes = endHours * 60 + endMinutes

      if (startTotalMinutes >= endTotalMinutes) {
        alert('End time must be after start time')
        return
      }

      const timeSlots: string[] = []
      for (let minutes = startTotalMinutes; minutes < endTotalMinutes; minutes += 30) {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        timeSlots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`)
      }

      // Generate slots for each date in range that matches selected days
      const slotsToInsert: Array<{ giver_id: string; date: string; time: string; is_booked: boolean }> = []
      const currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay()

        if (bulkSelectedDays.has(dayOfWeek)) {
          const dateStr = currentDate.toISOString().split('T')[0]

          timeSlots.forEach(time => {
            slotsToInsert.push({
              giver_id: user.id,
              date: dateStr,
              time,
              is_booked: false
            })
          })
        }

        currentDate.setDate(currentDate.getDate() + 1)
      }

      if (slotsToInsert.length === 0) {
        alert('No slots to add. Please select at least one day of the week.')
        return
      }

      // Best-effort insert: insert each slot individually, skip duplicates
      const insertedSlots: AvailabilitySlot[] = []
      let duplicateCount = 0

      for (const slot of slotsToInsert) {
        const { data, error } = await supabase
          .from('giver_availability')
          .insert(slot)
          .select()
          .single()

        if (error) {
          // Error code 23505 = unique_violation (duplicate)
          if (error.code === '23505') {
            duplicateCount++
          } else {
            // Log other errors but continue
            console.error('Error inserting slot:', error)
          }
        } else if (data) {
          insertedSlots.push(data)
        }
      }

      if (insertedSlots.length > 0) {
        setAvailabilitySlots(prev => [...prev, ...insertedSlots])
      }

      // Show detailed success message
      const startDateObj = new Date(bulkStartDate + 'T00:00:00')
      const endDateObj = new Date(bulkEndDate + 'T00:00:00')
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const selectedDayNames = Array.from(bulkSelectedDays).sort().map(i => dayNames[i]).join(', ')

      const message = `Added ${insertedSlots.length} new slot${insertedSlots.length !== 1 ? 's' : ''} from ${startDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ` +
        `to ${endDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}\n` +
        `Days: ${selectedDayNames}\n` +
        `Time: ${formatTimeTo12Hour(bulkStartTime)} - ${formatTimeTo12Hour(bulkEndTime)}` +
        (duplicateCount > 0 ? `\n\n(Skipped ${duplicateCount} duplicate slot${duplicateCount !== 1 ? 's' : ''})` : '')

      alert(message)
    } catch (err) {
      console.error('Error adding bulk availability slots:', err)
      alert('Error adding slots. Some may already exist.')
    }
  }

  // Toggle day selection for bulk add
  const toggleBulkDay = (dayIndex: number) => {
    setBulkSelectedDays(prev => {
      const newSet = new Set(prev)
      if (newSet.has(dayIndex)) {
        newSet.delete(dayIndex)
      } else {
        newSet.add(dayIndex)
      }
      return newSet
    })
  }

  // Get total slots selected
  const getTotalSlots = () => {
    return availabilitySlots.length
  }

  // Fetch available slots for a specific giver
  const fetchGiverAvailableSlots = useCallback(async (giverId: string) => {
    try {
      // Use local date, not UTC
      const today = new Date()
      const todayLocal = formatDateLocal(today)
      const nowTimestamp = Date.now()

      const { data, error } = await supabase
        .from('giver_availability')
        .select('*')
        .eq('giver_id', giverId)
        .eq('is_booked', false)
        .gte('date', todayLocal) // Only future dates (local timezone)
        .order('date', { ascending: true })
        .order('time', { ascending: true })

      if (error) {
        console.error('Error fetching giver availability:', error)
        throw error
      }

      // CLIENT-SIDE GUARD: Filter out slots where date+time has already passed
      const futureSlots = (data || []).filter(slot => {
        const slotDate = new Date(slot.date + 'T00:00:00')
        const [hours, minutes] = slot.time.split(':').map(Number)
        slotDate.setHours(hours, minutes, 0, 0)
        return slotDate.getTime() > nowTimestamp
      })

      console.log(`Fetched ${data?.length || 0} available slots for giver ${giverId}, filtered to ${futureSlots.length} future slots`)
      return futureSlots
    } catch (err) {
      console.error('Error fetching giver availability:', err)
      return []
    }
  }, [])

  // Convert 24-hour time (HH:MM) to 12-hour format (h:MM AM/PM)
  const formatTimeTo12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Format date as YYYY-MM-DD in local timezone (not UTC)
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get timezone abbreviation (ET, PT, etc.)
  const getTimezoneAbbr = (timezone: string): string => {
    const tzMap: { [key: string]: string } = {
      'America/New_York': 'ET',
      'America/Chicago': 'CT',
      'America/Denver': 'MT',
      'America/Phoenix': 'AZ',
      'America/Los_Angeles': 'PT',
      'America/Anchorage': 'AKT',
      'Pacific/Honolulu': 'HT',
    }
    return tzMap[timezone] || timezone
  }

  // Format time with timezone indicator (e.g., "2:00 PM ET")
  const formatTimeWithTz = (time: string, timezone: string): string => {
    return `${formatTimeTo12Hour(time)} ${getTimezoneAbbr(timezone)}`
  }

  // Format date for display
  const formatDate = (date: Date) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  // Format date for full display
  const formatFullDate = (date: Date, time: string) => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }
    return `${date.toLocaleDateString('en-US', options)} at ${formatTimeTo12Hour(time)}`
  }

  // Convert time string to scheduled datetime (accepts HH:MM format)
  const getScheduledTime = (date: Date, time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const scheduled = new Date(date)
    scheduled.setHours(hours, minutes, 0, 0)
    return scheduled.toISOString()
  }

  // Fetch unused credits for current user
  const fetchUnusedCredits = async () => {
    if (!user) return { credits: [], totalCents: 0 }

    try {
      const { data: credits, error } = await supabase
        .from('credits')
        .select('*')
        .eq('user_id', user.id)
        .is('used_at', null)
        .order('created_at', { ascending: true }) // Use oldest credits first

      if (error) {
        console.error('Error fetching credits:', error)
        return { credits: [], totalCents: 0 }
      }

      const totalCents = (credits || []).reduce((sum, credit) => sum + credit.amount_cents, 0)
      setAvailableCredits(credits || [])
      setTotalCreditsCents(totalCents)
      return { credits: credits || [], totalCents }
    } catch (err) {
      console.error('Error fetching credits:', err)
      return { credits: [], totalCents: 0 }
    }
  }

  // Create a booking
  const createBooking = async () => {
    if (!user || !selectedGiver || !selectedBookingDate || !selectedBookingTime) return

    setBookingLoading(true)
    setBookingError('')

    try {
      const scheduledTime = getScheduledTime(selectedBookingDate, selectedBookingTime)

      // PRICING MODEL: Platform fee (15%) is ADDED ON TOP of giver's net price
      // Giver sets NET price (what they receive)
      // Receiver pays GROSS price (net + 15% platform fee, rounded up)
      const basePrice = selectedListingForBooking
        ? selectedListingForBooking.price_cents / 100
        : (selectedGiver.rate_per_30 ?? 0)
      const durationMinutes = blocksBooked * TOTAL_BLOCK_MINUTES
      const amountCents = Math.round(basePrice * 100) // Per-block net amount

      // Calculate NET amount (what giver receives)
      const netAmountCents = amountCents * blocksBooked

      // Calculate GROSS amount (what receiver pays) - add 15% on top, round up
      const grossAmountCents = Math.ceil(netAmountCents / (1 - 0.15))

      // Fetch available credits
      const { totalCents: availableCreditsCents } = await fetchUnusedCredits()

      // Calculate credit application
      const creditsToApplyCents = Math.min(availableCreditsCents, grossAmountCents)
      setCreditsAppliedCents(creditsToApplyCents)

      // SERVER-SIDE GUARD: Reject booking if scheduled time is in the past
      const scheduledTimestamp = new Date(scheduledTime).getTime()
      const nowTimestamp = Date.now()
      if (scheduledTimestamp <= nowTimestamp) {
        throw new Error('That time has already passed. Please refresh and choose another slot.')
      }

      // Determine initial status based on listing approval settings
      const requiresApproval = selectedListingForBooking?.requires_approval !== false // Default true
      const allowInstantBook = selectedListingForBooking?.allow_instant_book || false
      const initialStatus = (requiresApproval && !allowInstantBook) ? 'pending_approval' : 'pending'

      // Create booking record - use only actual bookings table columns
      console.log('🔍 DEBUG: Creating booking with data:', {
        seeker_id: user.id,
        giver_id: selectedGiver.id,
        scheduled_time: scheduledTime,
        duration_minutes: durationMinutes,
        amount_cents: grossAmountCents, // Store gross amount (what receiver pays)
        session_intention: sessionIntention || null,
        status: initialStatus,
        stripe_payment_id: null,
        video_room_url: null,
      })

      const { data, error } = await supabase
        .from('bookings')
        .insert({
          seeker_id: user.id,
          giver_id: selectedGiver.id,
          scheduled_time: scheduledTime,
          duration_minutes: durationMinutes,
          amount_cents: grossAmountCents, // Store gross amount (what receiver pays)
          session_intention: sessionIntention || null,
          status: initialStatus,
          stripe_payment_id: null,
          video_room_url: null,
        })
        .select()
        .single()

      console.log('🔍 DEBUG: Booking creation result:', { data, error })

      if (error) {
        console.error('❌ DEBUG: Booking creation failed:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw error
      }

      setCurrentBooking(data)

      // Send booking creation emails
      try {
        await supabase.functions.invoke('send-booking-emails', {
          body: {
            booking_id: data.id,
            event: initialStatus === 'pending_approval' ? 'pending_approval' : 'created',
          },
        })
        console.log('✅ Booking creation emails sent')
      } catch (emailError) {
        console.error('⚠️ Failed to send booking emails:', emailError)
        // Don't block the booking flow if emails fail
      }

      setScreen('payment')
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Failed to create booking')
    } finally {
      setBookingLoading(false)
    }
  }

  // Process payment and confirm booking
  const processPayment = async () => {
    console.log('🔵 processPayment called', { currentBooking, user: user?.id, userProfile: userProfile?.id })

    if (!currentBooking || !user || !userProfile) {
      console.error('❌ processPayment early return:', {
        hasBooking: !!currentBooking,
        hasUser: !!user,
        hasUserProfile: !!userProfile
      })
      return
    }

    console.log('✅ processPayment validation passed, starting payment flow')
    setBookingLoading(true)
    setBookingError('')

    try {
      // Calculate amount after credits
      const grossAmountCents = currentBooking.amount_cents // amount_cents stores gross amount
      const amountAfterCreditsCents = Math.max(0, grossAmountCents - creditsAppliedCents)

      console.log('💰 Payment amounts:', {
        grossAmountCents,
        creditsAppliedCents,
        amountAfterCreditsCents
      })

      let payment_intent_id: string | null = null

      // Only process Stripe payment if there's a remaining balance
      if (amountAfterCreditsCents > 0) {
        console.log('💳 Processing Stripe payment for $' + (amountAfterCreditsCents / 100).toFixed(2))
        // Validate card inputs (basic validation)
        if (!cardNumber || cardNumber.replace(/\s/g, '').length < 15) {
          throw new Error('Please enter a valid card number')
        }
        if (!cardExpiry || !cardExpiry.includes('/')) {
          throw new Error('Please enter a valid expiry date (MM/YY)')
        }
        if (!cardCvc || cardCvc.length < 3) {
          throw new Error('Please enter a valid CVC')
        }

        // Phase 7: Real Stripe Integration
        // Step 1: Create PaymentIntent on backend
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No active session')

        const paymentIntentResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            amount_cents: amountAfterCreditsCents, // Reduced amount after credits
            booking_id: currentBooking.id,
            type: 'booking',
            seeker_email: user.email,
            giver_id: currentBooking.giver_id,
          })
        })

        if (!paymentIntentResponse.ok) {
          const errorData = await paymentIntentResponse.json()
          throw new Error(errorData.error || 'Failed to create payment intent')
        }

        const { client_secret: _clientSecret, payment_intent_id: pid } = await paymentIntentResponse.json()
        payment_intent_id = pid

        // Step 2: Confirm payment with Stripe
        // TODO: Production - Use Stripe Elements for PCI compliance
        // For now, simulating payment confirmation
        // In production, you would:
        // 1. Use Stripe Elements to securely collect card details
        // 2. Call stripe.confirmCardPayment(_clientSecret, { payment_method: elementId })
        // 3. Or use Stripe Checkout for a hosted payment page

        const stripe = await getStripe()
        if (!stripe) throw new Error('Stripe failed to load')

        // Simulate payment success for demo
        await new Promise(resolve => setTimeout(resolve, 1500))

        // In production, this would be the result from stripe.confirmCardPayment()
        const paymentSucceeded = true

        if (!paymentSucceeded) {
          throw new Error('Payment was not successful')
        }
      } else {
        // Fully covered by credits - no Stripe payment needed
        console.log('Booking fully covered by credits, skipping Stripe payment')
      }

      // Mark credits as used
      if (creditsAppliedCents > 0) {
        let remainingToApply = creditsAppliedCents
        for (const credit of availableCredits) {
          if (remainingToApply <= 0) break

          const amountToUse = Math.min(credit.amount_cents, remainingToApply)
          if (amountToUse > 0) {
            await supabase
              .from('credits')
              .update({
                used_at: new Date().toISOString(),
                booking_id: currentBooking.id
              })
              .eq('id', credit.id)

            remainingToApply -= amountToUse
          }
        }
      }

      // Step 3: Create Daily.co room for the video session
      // DISABLED: Room creation now happens at join-time via ensure-fresh-room edge function
      // This prevents stale room URLs (rooms expire after 35 minutes but sessions can be scheduled days in advance)
      let videoRoomUrl: string | null = null

      // Step 4: Update booking status and payment details
      // Important: Keep status as 'pending_approval' if it requires giver approval
      // Only set to 'confirmed' if it was 'pending' (instant book)
      const newStatus = currentBooking.status === 'pending_approval' ? 'pending_approval' : 'confirmed'

      console.log('🔵 Updating booking in database:', {
        booking_id: currentBooking.id,
        newStatus,
        payment_intent_id,
        videoRoomUrl
      })

      const { error } = await supabase
        .from('bookings')
        .update({
          status: newStatus,
          stripe_payment_id: payment_intent_id, // Fixed: was stripe_payment_intent_id
          video_room_url: videoRoomUrl,
        })
        .eq('id', currentBooking.id)

      if (error) {
        console.error('❌ Database update error:', error)
        throw error
      }

      console.log('✅ Booking updated successfully')

      // Send confirmation notification only if auto-confirmed
      if (newStatus === 'confirmed') {
        sendNotification('booking_confirmed', currentBooking.id)
      }

      // Update local booking state
      setCurrentBooking({
        ...currentBooking,
        status: newStatus,
        stripe_payment_id: payment_intent_id,
        video_room_url: videoRoomUrl,
      })

      // Clear card inputs
      setCardNumber('')
      setCardExpiry('')
      setCardCvc('')

      console.log('✅ Payment complete! Redirecting to confirmation screen')

      // Go to confirmation
      setScreen('confirmation')
    } catch (err) {
      console.error('❌ Payment error:', err)
      setBookingError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      console.log('🔵 processPayment finished, setting loading to false')

      setBookingLoading(false)
    }
  }

  // OLD: Process extension payment and add time (Phase 6 + Phase 7) - REPLACED with receiver-initiated flow
  /* const _processExtensionPayment = async () => {
    if (!activeSession || !user) return

    try {
      // PRICING MODEL: Extension uses same NET price as original booking
      const netAmountCents = activeSession.amount_cents || 0
      const grossAmountCents = Math.ceil(netAmountCents / (1 - 0.15))
      const platformFeeCents = grossAmountCents - netAmountCents
      const totalAmountCents = grossAmountCents

      console.log(`Processing extension payment: $${(totalAmountCents / 100).toFixed(2)}`)

      // Phase 7: Real Stripe Integration
      // Step 1: Create PaymentIntent on backend
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active session')

      const paymentIntentResponse = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          amount_cents: totalAmountCents,
          booking_id: activeSession.id,
          type: 'extension',
          seeker_email: user.email,
          giver_id: activeSession.giver_id,
        })
      })

      if (!paymentIntentResponse.ok) {
        const errorData = await paymentIntentResponse.json()
        throw new Error(errorData.error || 'Failed to create payment intent')
      }

      const { payment_intent_id } = await paymentIntentResponse.json()

      // Step 2: In production, payment would be auto-confirmed using saved payment method
      // For now, we create the extension record with payment intent ID
      // The webhook will update when payment is confirmed

      // TODO: Production - Use stored payment method to auto-confirm
      // const stripe = await getStripe()
      // await stripe.confirmCardPayment(client_secret, {
      //   payment_method: savedPaymentMethodId
      // })

      // Create extension record in database
      const { error: extensionError } = await supabase
        .from('extensions')
        .insert({
          booking_id: activeSession.id,
          amount_cents: extensionPriceCents,
          stripe_payment_intent_id: payment_intent_id,
          giver_confirmed: true,
          seeker_confirmed: true,
        })
        .select()
        .single()

      if (extensionError) throw extensionError

      // Update booking with incremented extended_count
      const currentExtendedCount = activeSession.extended_count || 0
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          extended_count: currentExtendedCount + 1,
        })
        .eq('id', activeSession.id)

      if (bookingError) throw bookingError

      // Add 30 minutes to session time
      setSessionTimeRemaining(prev => prev + (30 * 60)) // Add 30 minutes in seconds

      // Update local activeSession state
      setActiveSession({
        ...activeSession,
        extended_count: currentExtendedCount + 1,
      })

      console.log('Extension payment processed! Added 30 minutes to session.')
    } catch (err) {
      console.error('Extension payment failed:', err)
      // Show error message to user
      alert(`Extension payment failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  } */

  // Submit post-session feedback (Phase 8)
  const submitFeedback = async () => {
    if (!feedbackBooking || !user || wouldBookAgain === null || matchedMode === null) {
      alert('Please answer both feedback questions')
      return
    }

    setFeedbackSubmitting(true)

    try {
      // Insert feedback into database
      const { error } = await supabase
        .from('feedback')
        .insert({
          booking_id: feedbackBooking.id,
          seeker_id: user.id,
          giver_id: feedbackBooking.giver_id,
          would_book_again: wouldBookAgain,
          matched_mode: matchedMode,
        })

      if (error) throw error

      // Reset feedback state
      setFeedbackBooking(null)
      setWouldBookAgain(null)
      setMatchedMode(null)

      // Show success message and return to sessions
      alert('Thank you for your feedback!')
      setScreen('sessions')

      // Refresh bookings to update feedback status
      fetchUserBookings()
    } catch (err) {
      console.error('Feedback submission error:', err)
      alert(`Failed to submit feedback: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  // Send email notification (placeholder - actual emails to be implemented later)
  const sendNotification = async (type: 'booking_confirmed' | 'session_reminder' | 'cancellation', bookingId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ type, booking_id: bookingId })
      })

      const result = await response.json()
      console.log('Notification sent:', result)
    } catch (err) {
      console.error('Failed to send notification:', err)
      // Don't throw - notifications are non-critical
    }
  }

  // TODO: Add scheduled task to send session reminders 24 hours before scheduled_time
  // This will require a cron job or scheduled edge function to:
  // 1. Query all bookings where scheduled_time is in 24 hours
  // 2. Call sendNotification('session_reminder', booking.id) for each
  // Consider using Supabase pg_cron or a separate scheduler service

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = (matches && matches[0]) || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    return parts.length ? parts.join(' ') : value
  }

  // Format expiry date
  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4)
    }
    return v
  }

  // Fetch givers from database (simplified - multi-listing architecture deprecated)
  const fetchGivers = useCallback(async () => {
    try {
      console.log('📥 Fetching givers from profiles...')
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles_public')
        .select(`
          *,
          giver_availability!left (
            date,
            time,
            is_booked
          )
        `)
        .eq('is_giver', true)

      if (profilesError) {
        console.error('❌ Error fetching givers:', profilesError)
        throw profilesError
      }

      console.log(`✅ Loaded ${profilesData?.length || 0} giver profiles`)

      // Simplified: Just use profiles directly (multi-listing deprecated)
      // Each giver has a single profile with rate_per_30, video_url, etc.
      if (profilesData && profilesData.length > 0) {
        setGivers(profilesData.map(g => ({ ...g, listings: [] })))
      } else {
        setGivers([])
      }
    } catch (err) {
      console.error('Error fetching givers:', err)
      // Keep demo givers on error
    }
  }, [])

  useEffect(() => {
    // Skip during active video session to avoid rerenders
    if (screen === 'videoSession' && activeSession) {
      console.log('SUSPEND: Skipping fetchGivers - active session in progress')
      return
    }
    fetchGivers()
  }, [fetchGivers, screen, activeSession])

  // Fetch current user's giver profile
  const fetchMyGiverProfile = useCallback(async () => {
    if (!user) {
      setMyGiverProfile(null)
      return
    }

    try {
      // Fetch public profile data
      console.log('🔍 CALLSITE: fetchMyGiverProfile/public profiles_public - fetching giver profile')
      const { data: publicData, error: publicError } = await supabase
        .from('profiles_public')
        .select('*')
        .eq('id', user.id)
        .eq('is_giver', true)
        .single()

      // Explicit error logging for profiles_public fetch
      if (publicError && publicError.code !== 'PGRST116') {
        console.error('🚨 ERROR: fetchMyGiverProfile/public profiles_public', {
          callsite: 'fetchMyGiverProfile/public profiles_public',
          table: 'profiles_public',
          selectFields: '*',
          filter: `id.eq.${user.id}, is_giver.eq.true`,
          errorCode: publicError.code,
          errorMessage: publicError.message,
          errorDetails: publicError.details,
          errorHint: publicError.hint,
          fullError: publicError
        })
      }

      // 403 Error Detection for profiles_public
      if (publicError && (publicError.code === '403' || publicError.code === 'PGRST301' || (publicError as any).status === 403)) {
        console.error('🚨 403 FORBIDDEN ERROR DETECTED', {
          callsite: 'fetchMyGiverProfile/public profiles_public',
          table: 'profiles_public',
          selectFields: '*',
          filter: `id.eq.${user.id}, is_giver.eq.true`,
          errorCode: publicError.code,
          errorMessage: publicError.message,
          errorDetails: publicError.details,
          errorHint: publicError.hint,
          fullError: publicError
        })
      }

      if (publicError && publicError.code !== 'PGRST116') throw publicError

      if (!publicData) {
        setMyGiverProfile(null)
        return
      }

      // Auth timing guard: Only fetch private fields if session exists
      // This prevents 403 errors when auth is not fully ready
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        console.log('⏸️ fetchMyGiverProfile: No session yet, skipping private profiles fetch. Will retry on auth state change.')
        setMyGiverProfile(publicData as Giver)
        return
      }

      // Fetch private fields (stripe_account_id, stripe_onboarding_complete) from profiles table
      // This requires profiles_select_own policy to be in place AND authenticated session
      console.log('🔍 CALLSITE: fetchMyGiverProfile/private profiles - fetching stripe fields')
      const { data: privateData, error: privateError } = await supabase
        .from('profiles')
        .select('stripe_account_id, stripe_onboarding_complete')
        .eq('id', user.id)
        .single()

      // Explicit error logging for profiles private fetch
      if (privateError) {
        console.error('🚨 ERROR: fetchMyGiverProfile/private profiles', {
          callsite: 'fetchMyGiverProfile/private profiles',
          table: 'profiles',
          selectFields: 'stripe_account_id, stripe_onboarding_complete',
          filter: `id.eq.${user.id}`,
          errorCode: privateError.code,
          errorMessage: privateError.message,
          errorDetails: privateError.details,
          errorHint: privateError.hint,
          fullError: privateError
        })
      }

      // 403 Error Detection for profiles
      if (privateError && (privateError.code === '403' || privateError.code === 'PGRST301' || (privateError as any).status === 403)) {
        console.error('🚨 403 FORBIDDEN ERROR DETECTED', {
          callsite: 'fetchMyGiverProfile/private profiles',
          table: 'profiles',
          selectFields: 'stripe_account_id, stripe_onboarding_complete',
          filter: `id.eq.${user.id}`,
          errorCode: privateError.code,
          errorMessage: privateError.message,
          errorDetails: privateError.details,
          errorHint: privateError.hint,
          fullError: privateError
        })
      }

      // Merge public and private data
      setMyGiverProfile({ ...publicData, ...privateData })

      // Log and set stripe state
      const stripeStateData = {
        hasStripeAccountId: !!privateData?.stripe_account_id,
        onboardingComplete: !!privateData?.stripe_onboarding_complete,
        isGiver: !!publicData?.is_giver
      }
      console.log('STRIPE_STATE', stripeStateData)
      setStripeState(stripeStateData)
    } catch {
      setMyGiverProfile(null)
      setStripeState(null)
    }
  }, [user])

  useEffect(() => {
    // Skip during active video session to avoid rerenders
    if (screen === 'videoSession' && activeSession) {
      console.log('SUSPEND: Skipping fetchMyGiverProfile - active session in progress')
      return
    }
    fetchMyGiverProfile()
  }, [fetchMyGiverProfile, screen, activeSession])

  // Log 403 count on app boot
  useEffect(() => {
    console.log('403_COUNT_SO_FAR (app boot):', forbidden403Count)
  }, [])

  // Log 403 count when entering sessions screen
  useEffect(() => {
    if (screen === 'sessions') {
      console.log('403_COUNT_SO_FAR (sessions screen):', forbidden403Count)
    }
  }, [screen])

  // Hash router: map URL hashes to screen states
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      console.log('[Hash Router] Hash changed:', hash)

      // Map hash routes to screen states
      if (hash === '#/admin/email-events' || hash === '#/emailEvents') {
        console.log('[Hash Router] Admin route blocked, redirecting to sessions')
        setScreen('sessions')
      } else if (hash === '#/sessions') {
        setScreen('sessions')
      } else if (hash === '#/bookings') {
        setScreen('sessions')
      }
      // Add more mappings as needed
    }

    // Handle initial hash on mount
    handleHashChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Check for shareable giver link on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const giverId = params.get('giver')
    if (giverId) {
      // Fetch this giver and show their profile
      supabase
        .from('profiles_public')
        .select('*')
        .eq('id', giverId)
        .eq('is_giver', true)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelectedGiver(data)
            // Also fetch their availability
            supabase
              .from('giver_availability')
              .select('*')
              .eq('giver_id', giverId)
              .gte('date', new Date().toISOString().split('T')[0])
              .then(({ data: slots }) => {
                if (slots) setSelectedGiverSlots(slots)
              })
            setScreen('publicGiverProfile')
          }
        })
    }
  }, [])

  // Helper: Wait for session user (doesn't depend on React state)
  const waitForSessionUser = async () => {
    const maxAttempts = 60 // 60 * 500ms = 30 seconds
    for (let i = 0; i < maxAttempts; i++) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        return session.user
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    console.error('❌ [STRIPE RETURN] Session user not loaded after 30 seconds')
    return null
  }

  // Check if returning from Stripe Connect onboarding (hash routing)
  useEffect(() => {
    const checkOnboardingReturn = async () => {
      // Guard: only run once per page load
      if (stripeReturnHandledRef.current) return

      const hash = window.location.hash
      const currentUrl = window.location.href

      console.log('🔍 [STRIPE RETURN] Checking for payout-setup-complete hash', {
        hash,
        currentUrl,
        hasUser: !!user,
        userId: user?.id || 'NO_USER_YET'
      })

      if (hash.includes('payout-setup-complete')) {
        stripeReturnHandledRef.current = true

        console.log('⏳ [STRIPE RETURN] Waiting for session user...')
        const sessionUser = await waitForSessionUser()

        if (!sessionUser) {
          // Timed out, stop here
          window.location.hash = '#/bookings'
          return
        }

        console.log('✅ [STRIPE RETURN] Session user loaded, proceeding with check-connect-status', {
          userId: sessionUser.id,
          currentUrl
        })

        // Check Connect status
        const complete = await checkStripeConnectStatus(sessionUser.id)
        if (complete) {
          console.log('✅ [STRIPE RETURN] Onboarding complete, redirecting to payoutSetupComplete screen')
          setScreen('payoutSetupComplete')
        } else {
          console.log('⚠️ [STRIPE RETURN] Onboarding not complete, redirecting back to payoutSetup')
          setScreen('payoutSetup')
        }
        // Clean up URL hash
        window.location.hash = '#/bookings'
      }
    }
    checkOnboardingReturn()
  }, [])

  // Start Stripe Connect onboarding
  const startStripeConnect = async () => {
    if (!user || !myGiverProfile) return

    setStripeConnectLoading(true)
    setStripeConnectError('')

    try {
      // Call edge function to create Stripe Connect account
      console.log('🔍 CALLSITE: create-connect-account - invoking edge function')
      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: {
          email: user.email,
          user_id: user.id,
          refresh_url: `${window.location.origin}/#/bookings`,
          return_url: `${window.location.origin}/#/payout-setup-complete`,
        },
      })

      if (error) {
        console.error('🚨 ERROR: create-connect-account', {
          callsite: 'create-connect-account',
          function: 'create-connect-account',
          errorCode: (error as any).code,
          errorMessage: (error as any).message || error,
          errorDetails: (error as any).details,
          fullError: error
        })
        throw error
      }

      // Log successful response (body keys only, no secrets)
      console.log('✅ create-connect-account response:', {
        responseKeys: data ? Object.keys(data) : [],
        hasOnboardingUrl: !!data?.onboarding_url
      })

      if (!data?.onboarding_url) {
        throw new Error('No onboarding URL received')
      }

      // Redirect to Stripe onboarding
      window.location.href = data.onboarding_url
    } catch (err) {
      setStripeConnectError(err instanceof Error ? err.message : 'Failed to set up payouts')
      setStripeConnectLoading(false)
    }
  }

  // Check Stripe Connect status (called when returning from onboarding)
  const checkStripeConnectStatus = async (userId?: string) => {
    const effectiveUserId = userId || user?.id
    if (!effectiveUserId) return

    try {
      console.log('🔍 CALLSITE: check-connect-status - invoking edge function')
      const { data, error } = await supabase.functions.invoke('check-connect-status', {
        body: {
          user_id: effectiveUserId,
        },
      })

      if (error) {
        console.error('🚨 ERROR: check-connect-status', {
          callsite: 'check-connect-status',
          function: 'check-connect-status',
          errorCode: (error as any).code,
          errorMessage: (error as any).message || error,
          errorDetails: (error as any).details,
          fullError: error
        })
        throw error
      }

      // Log check-connect-status response
      console.log('✅ check-connect-status response:', {
        onboarding_complete: data?.onboarding_complete,
        details_submitted: data?.details_submitted,
        charges_enabled: data?.charges_enabled
      })

      if (data?.onboarding_complete) {
        // Refetch profile to get updated stripe fields
        await fetchMyGiverProfile()
        return true
      }

      return false
    } catch (err) {
      console.error('Error checking Connect status:', err)
      return false
    }
  }

  // Create Daily.co room for a booking
  // DISABLED: Room creation now handled by ensure-fresh-room edge function at join-time
  // This prevents stale room URLs from rooms created at payment time
  // const createDailyRoom = async (): Promise<string> => {
  //   // Call backend API to create Daily room (expires in 35 minutes, max 2 participants)
  //   const response = await fetch('/api/create-room', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //     },
  //   })
  //
  //   if (!response.ok) {
  //     const errorData = await response.json()
  //     throw new Error(errorData.error || 'Failed to create video room')
  //   }
  //
  //   const { roomUrl } = await response.json()
  //   return roomUrl
  // }

  // Fetch user's bookings
  const fetchUserBookings = useCallback(async () => {
    console.log('🚨 BOOKING_FETCH_START', { userId: user?.id })

    if (!user) {
      setUserBookings([])
      setBookingsFetchError(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or(`seeker_id.eq.${user.id},giver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      console.log('🚨 BOOKING_FETCH_RESULT', {
        error: error ? { code: error.code, message: error.message } : null,
        dataLength: data?.length || 0
      })

      // 403 Error Detection
      if (error && (error.code === '403' || error.code === 'PGRST301' || (error as any).status === 403)) {
        console.error('🚨 403 FORBIDDEN ERROR DETECTED', {
          table: 'bookings',
          selectFields: '*',
          filter: `or(seeker_id.eq.${user.id},giver_id.eq.${user.id})`,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          fullError: error
        })
      }

      if (error) {
        setBookingsFetchError(error)
        throw error
      }

      setBookingsFetchError(null)
      setUserBookings(data || [])
    } catch (err) {
      console.error('BOOKING_FETCH_ERROR:', err)
      setUserBookings([])
    }
  }, [user])

  useEffect(() => {
    // Skip during active video session to avoid rerenders
    if (screen === 'videoSession' && activeSession) {
      console.log('SUSPEND: Skipping fetchUserBookings - active session in progress')
      return
    }
    fetchUserBookings()
  }, [fetchUserBookings, screen, activeSession])

  // Trigger fetch when entering sessions/debug-bookings screen
  useEffect(() => {
    // Skip during active video session
    if (screen === 'videoSession' && activeSession) {
      return
    }
    if (screen === 'sessions' || screen === 'debug-bookings') {
      fetchUserBookings()
    }
  }, [screen, fetchUserBookings, activeSession])

  // Auto-refresh sessions and confirmation pages
  useEffect(() => {
    // Skip during active video session
    if (screen === 'videoSession' && activeSession) {
      return
    }
    if (screen === 'sessions' || screen === 'confirmation') {
      const interval = setInterval(() => {
        fetchUserBookings()
      }, 10000) // Check every 10 seconds to update join button availability
      return () => clearInterval(interval)
    }
  }, [screen, fetchUserBookings, activeSession])

  // Fetch saved givers (private saves for seekers)
  const fetchSavedGivers = useCallback(async () => {
    if (!user) {
      setSavedGiverIds(new Set())
      return
    }

    try {
      const { data, error } = await supabase
        .from('saved_givers')
        .select('giver_id')
        .eq('seeker_id', user.id)

      if (error) {
        // Table might not exist yet - fail silently
        console.log('saved_givers fetch:', error.message)
        setSavedGiverIds(new Set())
        return
      }
      setSavedGiverIds(new Set(data?.map(s => s.giver_id) || []))
    } catch (err) {
      console.log('saved_givers error:', err)
      setSavedGiverIds(new Set())
    }
  }, [user])

  useEffect(() => {
    fetchSavedGivers()
  }, [fetchSavedGivers])

  // Fetch user profile with timezone
  const fetchUserProfile = useCallback(async () => {
    if (!user) {
      setUserProfile(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles_public')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        // Profile might not exist yet - that's OK
        console.log('profiles fetch:', error.message)
        setUserProfile(null)
        return
      }
      setUserProfile(data)
    } catch (err) {
      console.log('profiles error:', err)
      setUserProfile(null)
    }
  }, [user])

  useEffect(() => {
    fetchUserProfile()
  }, [fetchUserProfile])

  // === LISTING MANAGEMENT FUNCTIONS (Multi-Listing Architecture) ===

  // Fetch current user's listings
  const fetchMyListings = useCallback(async () => {
    if (!user) {
      setMyListings([])
      return
    }

    setListingsLoading(true)
    try {
      console.log('📥 Fetching my listings...')

      // Fetch listings (without categories - listing_categories deprecated)
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (listingsError) {
        console.error('❌ Error fetching listings:', listingsError)
        throw listingsError
      }

      console.log(`✅ Loaded ${listingsData?.length || 0} listings`)

      // Simplified: Listings without categories (multi-listing architecture deprecated)
      if (listingsData && listingsData.length > 0) {
        const listingsWithoutCategories = listingsData.map(listing => ({
          ...listing,
          categories: [] // Categories deprecated
        }))
        setMyListings(listingsWithoutCategories)
      } else {
        setMyListings([])
      }
    } catch (err) {
      console.error('Error fetching listings:', err)
      setMyListings([])
    } finally {
      setListingsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchMyListings()
  }, [fetchMyListings])

  // Create a new listing
  const createListing = async (listingData: {
    topic: string
    mode: Mode
    price_cents: number
    description: string
    categories: Category[]
    requires_approval?: boolean
    allow_instant_book?: boolean
    directions_allowed?: string[]
    boundaries?: string
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      // Ensure profile exists first
      const profileResult = await ensureProfileExists()
      if (!profileResult.success) return { success: false, error: profileResult.error || 'Failed to create profile' }

      // Insert listing
      const { data: newListing, error: listingError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          topic: listingData.topic || '',
          mode: listingData.mode,
          price_cents: listingData.price_cents,
          description: listingData.description,
          is_active: true,
          requires_approval: listingData.requires_approval !== undefined ? listingData.requires_approval : true,
          allow_instant_book: listingData.allow_instant_book || false,
          directions_allowed: listingData.directions_allowed || ['go_deeper', 'hear_perspective', 'think_together', 'build_next_step', 'end_cleanly'],
          boundaries: listingData.boundaries || null
        })
        .select()
        .single()

      if (listingError) throw listingError

      // Categories deprecated - multi-listing architecture no longer in use
      // Categories were stored in listing_categories table which is being phased out

      // Refresh listings
      await fetchMyListings()

      return { success: true, listing: newListing }
    } catch (err) {
      console.error('Error creating listing - FULL ERROR:', err)

      // Extract detailed error information from Supabase error
      let errorMessage = 'Failed to create offer'
      if (err && typeof err === 'object') {
        const supabaseError = err as any
        const parts = []

        if (supabaseError.message) parts.push(supabaseError.message)
        if (supabaseError.details) parts.push(`Details: ${supabaseError.details}`)
        if (supabaseError.hint) parts.push(`Hint: ${supabaseError.hint}`)
        if (supabaseError.code) parts.push(`Code: ${supabaseError.code}`)

        if (parts.length > 0) {
          errorMessage = parts.join(' | ')
        }
      } else if (err instanceof Error) {
        errorMessage = err.message
      }

      return { success: false, error: errorMessage }
    }
  }

  // Update an existing listing
  const updateListing = async (
    listingId: string,
    updates: {
      topic?: string
      mode?: Mode
      price_cents?: number
      description?: string
      categories?: Category[]
    }
  ) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      // Update listing
      const { topic, mode, price_cents, description, categories: _categories } = updates
      const listingUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }

      if (topic !== undefined) listingUpdates.topic = topic
      if (mode !== undefined) listingUpdates.mode = mode
      if (price_cents !== undefined) listingUpdates.price_cents = price_cents
      if (description !== undefined) listingUpdates.description = description

      const { error: listingError } = await supabase
        .from('listings')
        .update(listingUpdates)
        .eq('id', listingId)
        .eq('user_id', user.id) // Security: only update own listings

      if (listingError) throw listingError

      // Categories deprecated - multi-listing architecture no longer in use
      // Categories were stored in listing_categories table which is being phased out
      // TODO: If categories are needed, store them directly on the listings table

      // Refresh listings
      await fetchMyListings()

      return { success: true }
    } catch (err) {
      console.error('Error updating listing - FULL ERROR:', err)

      // Extract detailed error information from Supabase error
      let errorMessage = 'Failed to update offer'
      if (err && typeof err === 'object') {
        const supabaseError = err as any
        const parts = []

        if (supabaseError.message) parts.push(supabaseError.message)
        if (supabaseError.details) parts.push(`Details: ${supabaseError.details}`)
        if (supabaseError.hint) parts.push(`Hint: ${supabaseError.hint}`)
        if (supabaseError.code) parts.push(`Code: ${supabaseError.code}`)

        if (parts.length > 0) {
          errorMessage = parts.join(' | ')
        }
      } else if (err instanceof Error) {
        errorMessage = err.message
      }

      return { success: false, error: errorMessage }
    }
  }

  // Deactivate a listing (soft delete)
  // @ts-expect-error - Function kept for potential future UI restoration
  const deactivateListing = async (listingId: string) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      const { error } = await supabase
        .from('listings')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', listingId)
        .eq('user_id', user.id) // Security: only deactivate own listings

      if (error) throw error

      // Refresh listings
      await fetchMyListings()

      return { success: true }
    } catch (err) {
      console.error('Error deactivating listing:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Failed to deactivate listing' }
    }
  }

  // Reactivate a listing
  // @ts-expect-error - Function kept for potential future UI restoration
  const reactivateListing = async (listingId: string) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      const { error } = await supabase
        .from('listings')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', listingId)
        .eq('user_id', user.id) // Security: only reactivate own listings

      if (error) throw error

      // Refresh listings
      await fetchMyListings()

      return { success: true }
    } catch (err) {
      console.error('Error reactivating listing:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Failed to reactivate listing' }
    }
  }

  // === END LISTING MANAGEMENT FUNCTIONS ===

  // Load existing availability for existing givers
  useEffect(() => {
    if (user && myGiverProfile && (screen === 'editVideo' || screen === 'userProfile' || screen === 'manageAvailability')) {
      supabase
        .from('giver_availability')
        .select('*')
        .eq('giver_id', user.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .order('time', { ascending: true })
        .then(({ data }) => {
          if (data) setAvailabilitySlots(data)
        })
    }
  }, [user, myGiverProfile, screen])

  // Auto-redirect authenticated users without profiles to role selection
  useEffect(() => {
    if (screen === 'welcome' && user) {
      supabase
        .from('profiles_public')
        .select('name, is_giver')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          // If user has no profile or no name set, they're new → show role selection
          if (!data || !data.name) {
            setScreen('roleSelection')
          }
        })
    }
  }, [user, screen])

  // Toggle save/unsave a giver (private, no notifications)
  // Requires saved_givers table in Supabase with RLS policies
  const toggleSaveGiver = async (giverId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation() // Prevent card click
    }
    if (!user) {
      setReturnToScreen('browse')
      setNeedsAuth(true)
      return
    }

    const isSaved = savedGiverIds.has(giverId)

    // Optimistically update UI
    if (isSaved) {
      setSavedGiverIds(prev => {
        const next = new Set(prev)
        next.delete(giverId)
        return next
      })
    } else {
      setSavedGiverIds(prev => new Set(prev).add(giverId))
    }

    try {
      if (isSaved) {
        // Remove save
        const { error } = await supabase
          .from('saved_givers')
          .delete()
          .eq('seeker_id', user.id)
          .eq('giver_id', giverId)

        if (error) {
          console.log('Delete save error:', error.message)
          // Revert optimistic update
          setSavedGiverIds(prev => new Set(prev).add(giverId))
        }
      } else {
        // Add save
        const { error } = await supabase
          .from('saved_givers')
          .insert({
            seeker_id: user.id,
            giver_id: giverId,
          })

        if (error) {
          console.log('Save error:', error.message)
          // Revert optimistic update
          setSavedGiverIds(prev => {
            const next = new Set(prev)
            next.delete(giverId)
            return next
          })
        }
      }
    } catch (err) {
      console.error('Failed to toggle save:', err)
      // Revert on error
      if (isSaved) {
        setSavedGiverIds(prev => new Set(prev).add(giverId))
      } else {
        setSavedGiverIds(prev => {
          const next = new Set(prev)
          next.delete(giverId)
          return next
        })
      }
    }
  }

  // Join a video session
  const joinSession = async (booking: Booking) => {
    console.log('========================================')
    console.log('JOIN SESSION: User clicked Join Session button')
    console.log('JOIN SESSION: booking id:', booking.id)
    console.log('JOIN SESSION: booking video_room_url:', booking.video_room_url)

    // ALWAYS call ensure-fresh-room edge function to get a valid room URL
    // This ensures room is < 30 minutes old and handles concurrent joins safely
    let roomUrl: string
    try {
      // Get current session to pass Authorization header explicitly
      // Supabase functions.invoke should auto-attach this, but we do it explicitly to ensure JWT propagation
      const { data: sessionData } = await supabase.auth.getSession()
      console.log('JOIN SESSION: Auth session check:', {
        hasSession: !!sessionData.session,
        hasAccessToken: !!sessionData.session?.access_token,
        userId: sessionData.session?.user?.id,
        tokenLength: sessionData.session?.access_token?.length
      })

      if (!sessionData.session?.access_token) {
        throw new Error('No active session - please sign in again')
      }

      // RAW FETCH DIAGNOSTIC: Bypass supabase.functions.invoke to see exact gateway response
      const functionUrl = `https://ksramckuggspsqymcjpo.supabase.co/functions/v1/ensure-fresh-room`
      const apikeyHeader = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzcmFtY2t1Z2dzcHNxeW1janBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyNTMwODgsImV4cCI6MjA4MTgyOTA4OH0.CszijxFZU09QKH2aJbv6TjniWUJ1muJDnHXSe_u8DJc'

      console.log('JOIN SESSION: RAW FETCH DIAGNOSTIC')
      console.log('JOIN SESSION: Function URL:', functionUrl)
      console.log('JOIN SESSION: apikey header exists:', !!apikeyHeader)
      console.log('JOIN SESSION: Authorization header exists:', !!sessionData.session.access_token)
      console.log('JOIN SESSION: Request body:', JSON.stringify({ booking_id: booking.id }))

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apikeyHeader,
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: JSON.stringify({ booking_id: booking.id })
      })

      console.log('JOIN SESSION: Response status:', response.status)
      console.log('JOIN SESSION: Response statusText:', response.statusText)
      console.log('JOIN SESSION: Response headers:', Object.fromEntries(response.headers.entries()))

      const responseText = await response.text()
      console.log('JOIN SESSION: Response raw body:', responseText)

      let data: any
      try {
        data = JSON.parse(responseText)
        console.log('JOIN SESSION: Response parsed JSON:', data)
      } catch (parseErr) {
        console.error('JOIN SESSION: Failed to parse response as JSON:', parseErr)
        throw new Error(`Invalid response from server: ${responseText}`)
      }

      if (!response.ok) {
        console.error('JOIN SESSION: HTTP error', response.status, data)

        if (response.status === 401) {
          throw new Error('Unable to join the session right now. Please try again.')
        }

        throw new Error(`ensure-fresh-room failed: ${data.error || 'Unknown error'} (stage: ${data.stage || 'unknown'})`)
      }

      if (!data?.video_room_url) {
        console.error('JOIN SESSION: No room URL in response')
        throw new Error('No room URL returned from server')
      }

      roomUrl = data.video_room_url
      console.log(`JOIN SESSION: Got room URL (${data.was_refreshed ? 'refreshed' : 'reused'}):`, roomUrl)

      // Update local booking object
      booking.video_room_url = roomUrl
    } catch (err) {
      console.error('JOIN SESSION: Failed to ensure fresh room:', err)
      alert('Failed to prepare video room. Please try again or contact support.')
      return
    }

    // Log room URL for both giver and seeker
    const userRole = user?.id === booking.giver_id ? 'GIVER' : 'SEEKER'
    console.log(`JOIN SESSION: User role is ${userRole}`)
    console.log(`JOIN SESSION: Final room URL:`, roomUrl)

    // Track when giver joins (for lateness detection)
    if (user && user.id === booking.giver_id) {
      const joinTime = new Date()
      const scheduledTime = new Date(booking.scheduled_time)
      const lateMinutes = (joinTime.getTime() - scheduledTime.getTime()) / 1000 / 60

      // Automatic seeker credit if giver joins > 2 minutes late
      const updates: any = { giver_joined_at: joinTime.toISOString() }
      if (lateMinutes > 2) {
        updates.seeker_credit_earned = true

        // Increment giver's times_joined_late counter
        // ISOLATED: Catch any RPC errors to prevent blocking session startup
        try {
          await supabase.rpc('increment_times_joined_late', {
            giver_user_id: booking.giver_id
          })
        } catch (rpcError) {
          console.warn('[Join Session] increment_times_joined_late RPC failed (non-blocking):', rpcError)
        }
      }

      await supabase
        .from('bookings')
        .update(updates)
        .eq('id', booking.id)
    }

    console.log('JOIN SESSION: Setting activeSession state')
    setActiveSession(booking)

    // Time Physics (Phase 5): Active time = duration_minutes - 5 minutes buffer
    const totalMinutes = booking.duration_minutes || 30
    const activeMinutes = Math.max(totalMinutes - 5, 25) // Subtract 5 min buffer, minimum 25 min
    setSessionTimeRemaining(activeMinutes * 60) // Convert to seconds

    setShowTimeWarning(false)
    setShowCountdown(false)
    setExtensionTimeRemaining(60)

    // Create session_states row BEFORE transitioning to videoSession screen
    // This ensures the row exists before polling starts, preventing PGRST116 errors
    if (user) {
      try {
        console.log('[JOIN SESSION] Creating/ensuring session_states row for booking:', booking.id)
        const now = new Date().toISOString()

        // Attempt insert with ON CONFLICT DO NOTHING (idempotent)
        const { data: sessionState, error: sessionError } = await supabase
          .from('session_states')
          .upsert({
            booking_id: booking.id,
            current_phase: 'transmission',
            validation_attempts: 0,
            transmission_started_at: now,
            started_at: now,
            updated_by: user.id,
            updated_at: now
          }, {
            onConflict: 'booking_id',
            ignoreDuplicates: false // Update if exists
          })
          .select()
          .single()

        if (sessionError) {
          console.error('[JOIN SESSION] Failed to create session_states:', sessionError)
          // Non-fatal - SessionStateMachine will create it if needed
        } else {
          console.log('[JOIN SESSION] Session state ready:', {
            booking_id: booking.id,
            role: userRole,
            session_found: true,
            current_phase: sessionState.current_phase,
            transmission_started_at: sessionState.transmission_started_at
          })
        }
      } catch (err) {
        console.error('[JOIN SESSION] Exception creating session_states:', err)
        // Non-fatal - continue
      }
    }

    console.log('JOIN SESSION: Setting screen to videoSession')
    setScreen('videoSession')
    console.log('JOIN SESSION: joinSession completed')
    console.log('========================================')
  }

  // Start the Daily call
  const startDailyCall = useCallback(async () => {
    if (!activeSession?.video_room_url || !videoContainerRef.current) {
      console.error('DAILY: Cannot start - missing room URL or container')
      return
    }

    try {
      // Mobile detection and permission pre-check
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      console.log('[DAILY] Mobile device detected:', isMobile)

      if (isMobile) {
        console.log('[DAILY] Mobile path - requesting permissions explicitly before iframe init')
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
          })
          console.log('[DAILY] Mobile permissions granted, stream:', stream.id)
          // Stop tracks immediately - Daily will request again
          stream.getTracks().forEach(track => track.stop())
        } catch (permErr) {
          console.error('[DAILY] Mobile permission denied:', permErr)
          alert('Camera and microphone access required. Please grant permissions in your browser settings and try again.')
          return
        }
      }

      // Destroy existing call if any
      if (dailyCallRef.current) {
        await dailyCallRef.current.destroy()
      }

      // Create new Daily call (without auto-join to avoid listener race condition)
      const call = DailyIframe.createFrame(videoContainerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '3px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
      })

      dailyCallRef.current = call

      // Show giver overlay when both participants join
      if (user && user.id === activeSession.giver_id) {
        call.on('participant-joined', () => {
          const participants = call.participants()
          const participantCount = Object.keys(participants).length

          // When both are present (local + 1 remote)
          if (participantCount >= 2) {
            setShowGiverOverlay(true)
            // Fade after 5 seconds
            setTimeout(() => setShowGiverOverlay(false), 5000)
          }
        })
      }

      // Log remote participants when they join (diagnostic - updates in real-time)
      call.on('participant-joined', (event) => {
        console.log('========================================')
        console.log('DAILY: participant-joined event')
        console.log('DAILY: New participant:', event?.participant?.user_name || event?.participant?.session_id)

        const participants = call.participants()
        const remote = Object.keys(participants).filter(k => k !== 'local')
        console.log('DAILY: Updated remote participant count:', remote.length)

        remote.forEach(sessionId => {
          const p = participants[sessionId]
          console.log(`DAILY: Remote participant ${p.user_name || sessionId}:`, {
            video: p.video,
            audio: p.audio,
            tracks: p.tracks
          })
        })
        console.log('========================================')
      })

      // Track when participants leave (for both giver and seeker)
      call.on('participant-left', async () => {
        // Note: Individual participant leave times (giver_left_at, seeker_left_at)
        // are not tracked in the current schema. Session end time is tracked via ended_at.
      })

      call.on('error', (event) => {
        console.error('DAILY: error event:', event?.action, event?.errorMsg)
      })

      call.on('track-started', (event) => {
        console.log('DAILY: track-started event')
        console.log('DAILY: track participant:', event?.participant?.user_name || event?.participant?.session_id)
        console.log('DAILY: track type:', event?.track?.kind)
        console.log('DAILY: track state:', event?.track?.readyState)
      })

      call.on('track-stopped', (event) => {
        console.log('DAILY: track-stopped event')
        console.log('DAILY: track participant:', event?.participant?.user_name || event?.participant?.session_id)
        console.log('DAILY: track type:', event?.track?.kind)
      })


      call.on('joined-meeting', async () => {
        console.log('========================================')
        console.log('DAILY: joined-meeting event - successfully joined')
        setDailyMeetingJoined(true) // User completed prejoin, now show protocol UI

        const participants = call.participants()
        const localAudio = participants.local?.audio
        const userRole = user?.id === activeSession.giver_id ? 'giver' : 'receiver'

        console.log('DAILY: participant count:', Object.keys(participants).length)
        console.log('DAILY: local participant:', participants.local)
        if (participants.local) {
          console.log('DAILY: local video state:', participants.local.video)
          console.log('DAILY: local audio state:', participants.local.audio)
          console.log('DAILY: local tracks:', participants.local.tracks)
        }

        // Query session state for comprehensive logging
        try {
          const { data: sessionState } = await supabase
            .from('session_states')
            .select('*')
            .eq('booking_id', activeSession.id)
            .maybeSingle()

          console.log('[POST-JOIN STATE]', {
            booking_id: activeSession.id,
            role: userRole,
            session_row_found: !!sessionState,
            session_row_created: !!sessionState, // Same as found since we created in joinSession
            joined_local: true,
            joined_remote: Object.keys(participants).filter(k => k !== 'local').length > 0,
            phase: sessionState?.current_phase || 'unknown',
            phase_started_at: sessionState?.transmission_started_at || sessionState?.started_at,
            transmission_started_at: sessionState?.transmission_started_at,
            reflection_started_at: sessionState?.reflection_started_at,
            validation_started_at: sessionState?.validation_started_at,
            direction_started_at: sessionState?.direction_started_at,
            can_local_speak: userRole === 'receiver' || sessionState?.current_phase !== 'transmission',
            local_mic_intended_state: localAudio ? 'unmuted' : 'muted',
            local_mic_actual_state: participants.local?.audio ? 'unmuted' : 'muted'
          })
        } catch (err) {
          console.error('[POST-JOIN STATE] Error querying session state:', err)
        }

        // Log remote participants
        const remote = Object.keys(participants).filter(k => k !== 'local')
        console.log('DAILY: remote participant count:', remote.length)
        remote.forEach(sessionId => {
          const p = participants[sessionId]
          console.log(`DAILY: remote participant ${p.user_name || sessionId}:`, {
            video: p.video,
            audio: p.audio,
            tracks: p.tracks
          })
        })
        console.log('========================================')
      })

      call.on('left-meeting', () => {
        console.log('DAILY: left-meeting event')
      })

      // Join meeting manually AFTER all event listeners are attached
      // This ensures joined-meeting event is always caught
      console.log('DAILY: All event listeners attached, now joining meeting...')
      await call.join({ url: activeSession.video_room_url })
      console.log('DAILY: join() completed')

      // Diagnostic: Check actual meeting state after join resolves
      const meetingState = call.meetingState()
      console.log('DAILY: meetingState after join():', meetingState)
      console.log('DAILY: Expected: "joined-meeting", Actual:', meetingState)

      if (meetingState !== 'joined-meeting') {
        console.error('DAILY: join() resolved but meetingState is not "joined-meeting"')
        console.error('DAILY: This indicates join succeeded at connection level but failed at meeting admission level')
        console.error('DAILY: Possible causes: permissions denied, invalid room, room expired, or network issue')
      }

      // Log participants after join
      const participants = call.participants()
      console.log('DAILY: participants after join:', Object.keys(participants).length)
      console.log('DAILY: local participant:', participants.local)

      // Start monitoring iframe existence over time
      console.log('DAILY: Starting iframe monitoring (10 checks over 10 seconds)')
      const monitoringIntervals = [1000, 2000, 3000, 5000, 7000, 10000, 15000, 20000, 30000, 60000]
      monitoringIntervals.forEach((delay) => {
        setTimeout(() => {
          if (!videoContainerRef.current) {
            console.error(`DAILY MONITOR [${delay/1000}s]: videoContainerRef.current is NULL!`)
            return
          }

          const container = videoContainerRef.current
          const iframes = container.querySelectorAll('iframe')
          const rect = container.getBoundingClientRect()

          console.log(`DAILY MONITOR [${delay/1000}s]: iframe count =`, iframes.length)
          console.log(`DAILY MONITOR [${delay/1000}s]: container size =`, rect.width, 'x', rect.height)
          console.log(`DAILY MONITOR [${delay/1000}s]: container children =`, container.children.length)
          console.log(`DAILY MONITOR [${delay/1000}s]: dailyCallRef.current exists =`, !!dailyCallRef.current)

          if (iframes.length > 0) {
            const iframe = iframes[0] as HTMLIFrameElement
            console.log(`DAILY MONITOR [${delay/1000}s]: iframe src =`, iframe.src)
            console.log(`DAILY MONITOR [${delay/1000}s]: iframe size =`, iframe.offsetWidth, 'x', iframe.offsetHeight)
            console.log(`DAILY MONITOR [${delay/1000}s]: iframe display =`, getComputedStyle(iframe).display)
            console.log(`DAILY MONITOR [${delay/1000}s]: iframe visibility =`, getComputedStyle(iframe).visibility)
            console.log(`DAILY MONITOR [${delay/1000}s]: iframe opacity =`, getComputedStyle(iframe).opacity)
            console.log(`DAILY MONITOR [${delay/1000}s]: iframe zIndex =`, getComputedStyle(iframe).zIndex)
          } else {
            console.error(`DAILY MONITOR [${delay/1000}s]: NO IFRAME FOUND IN CONTAINER!`)
          }
        }, delay)
      })

    } catch (err) {
      console.error('DAILY: EXCEPTION in startDailyCall')
      console.error('DAILY: error type:', err instanceof Error ? err.constructor.name : typeof err)
      console.error('DAILY: error message:', err instanceof Error ? err.message : String(err))
      console.error('DAILY: full error:', err)

      // Make audio level observer and other non-critical errors non-fatal
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('audio level observer') || errorMessage.includes('AudioLevelObserver')) {
        console.warn('DAILY: Audio level observer failed (non-fatal):', errorMessage)
        // Continue - this is not critical for the session
      } else {
        console.error('DAILY: FATAL ERROR - showing alert to user')
        alert('Failed to join video session. Please refresh and try again.')
      }
    }

    console.log('DAILY: startDailyCall completed')
    console.log('========================================')
  }, [activeSession, user])

  // Finalize session - single authoritative completion path
  const finalizeSession = async (reason: 'completed' | 'safety_exit' | 'receiver_end_complete') => {
    console.log('========================================')
    console.log('[FINALIZE] finalizeSession called with reason:', reason)

    // Guard: prevent duplicate finalization
    if (isFinalizingRef.current) {
      console.log('[FINALIZE] Already finalizing, ignoring duplicate call')
      return
    }

    if (!activeSession) {
      console.log('[FINALIZE] No active session, nothing to finalize')
      return
    }

    // Mark as finalizing
    isFinalizingRef.current = true
    setIsFinalizingSession(true)
    console.log('[FINALIZE] Set isFinalizingRef.current = true')

    const completedSession = activeSession

    try {
      // Step 1: Leave Daily cleanly
      console.log('[FINALIZE] Step 1: Leaving Daily call')
      if (dailyCallRef.current) {
        await dailyCallRef.current.destroy()
        dailyCallRef.current = null
        console.log('[FINALIZE] Daily call destroyed')
      }

      // Step 2: Call server finalization endpoint
      console.log('[FINALIZE] Step 2: Calling finalize-session endpoint')
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      const response = await fetch(`${supabaseUrl}/functions/v1/finalize-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          booking_id: completedSession.id,
          end_reason: reason
        })
      })

      const result = await response.json()
      console.log('[FINALIZE] Server response:', result)

      if (!response.ok) {
        throw new Error(`Server finalization failed: ${result.error || 'Unknown error'}`)
      }

      console.log('[FINALIZE] Server finalization succeeded:', {
        payout: result.payout_net_cents,
        refund: result.refund_gross_cents,
        elapsed: result.elapsed_seconds,
        already_finalized: result.already_finalized
      })

      // Step 3: Clean up local state
      console.log('[FINALIZE] Step 3: Cleaning up local state')
      setActiveSession(null)
      setSessionTimeRemaining(30 * 60)
      setShowTimeWarning(false)
      setShowCountdown(false)
      setDailyMeetingJoined(false)
      setExtensionTimeRemaining(60)

      // Refresh bookings
      fetchUserBookings()

      // Step 4: Route to post-session screen
      console.log('[FINALIZE] Step 4: Routing to post-session screen')

      // Show feedback if completed and user is seeker
      if ((reason === 'completed' || reason === 'receiver_end_complete') && user && user.id === completedSession.seeker_id) {
        // Check if feedback already exists
        const { data: existingFeedback } = await supabase
          .from('feedback')
          .select('id')
          .eq('booking_id', completedSession.id)
          .eq('seeker_id', user.id)
          .single()

        if (!existingFeedback) {
          setFeedbackBooking(completedSession)
          setScreen('feedback')
          console.log('[FINALIZE] Routed to feedback screen')
        } else {
          setScreen('sessions')
          console.log('[FINALIZE] Feedback already exists, routed to sessions')
        }
      } else {
        setScreen('sessions')
        console.log('[FINALIZE] Routed to sessions screen')
      }

    } catch (err) {
      console.error('[FINALIZE] Error during finalization:', err)
      alert('Your session ended, but there may have been a problem saving the final state. Please check Sessions.')

      // Clean up anyway to prevent stuck state
      setActiveSession(null)
      setScreen('sessions')
    } finally {
      setIsFinalizingSession(false)
      // Don't reset isFinalizingRef - keep it true to prevent re-entry
      console.log('[FINALIZE] Finalization complete')
      console.log('========================================')
    }
  }

  // Leave the video session
  const leaveSession = async (markComplete: boolean = false) => {
    console.log('========================================')
    console.log('LEAVE SESSION: leaveSession called, markComplete =', markComplete)

    // Destroy Daily call
    if (dailyCallRef.current) {
      console.log('LEAVE SESSION: Destroying Daily call object')
      await dailyCallRef.current.destroy()
      dailyCallRef.current = null
      console.log('LEAVE SESSION: Daily call destroyed and ref set to null')
    } else {
      console.log('LEAVE SESSION: No Daily call to destroy (already null)')
    }

    // Store session for potential feedback
    const completedSession = activeSession

    // Mark session as completed if time expired
    if (markComplete && activeSession) {
      await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', activeSession.id)

      // Increment giver's total_sessions_completed counter
      await supabase.rpc('increment_sessions_completed', {
        giver_user_id: activeSession.giver_id
      })

      // Refresh bookings
      fetchUserBookings()
    }

    setActiveSession(null)
    setSessionTimeRemaining(30 * 60)
    setShowTimeWarning(false)
    setShowCountdown(false)
    setDailyMeetingJoined(false) // Reset Daily join state

    // Reset state
    setExtensionTimeRemaining(60)

    // Phase 8: Show feedback prompt if session completed and user is seeker
    if (markComplete && completedSession && user && user.id === completedSession.seeker_id) {
      // Check if feedback already exists
      const { data: existingFeedback } = await supabase
        .from('feedback')
        .select('id')
        .eq('booking_id', completedSession.id)
        .eq('seeker_id', user.id)
        .single()

      if (!existingFeedback) {
        // Show feedback screen
        setFeedbackBooking(completedSession)
        setScreen('feedback')
        return
      }
    }

    setScreen('sessions')
  }

  // Play gentle audio chime for time orientation
  const playChime = useCallback(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Soft, gentle chime - not urgent
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime) // Higher frequency for pleasant tone
    oscillator.type = 'sine'

    // Gentle fade in and out
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1) // Soft volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 1.5)
  }, [])

  // Session timer effect (Phase 5: Time Physics + Phase 6: Extensions)
  useEffect(() => {
    if (!activeSession || screen !== 'videoSession') return

    const timer = setInterval(() => {
      setSessionTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - finalize session
          clearInterval(timer)
          setShowCountdown(false)
          finalizeSession('completed')
          return 0
        }

        // 30-second countdown overlay
        if (prev === 30 && !showCountdown) {
          setShowCountdown(true)
        }

        // 5-minute warning chime (before final buffer)
        if (prev === 5 * 60) {
          playChime()
          setShowTimeWarning(true)
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [activeSession, screen, finalizeSession, playChime, showCountdown])

  // Start Daily call when entering video session
  useEffect(() => {
    const timestamp = new Date().toISOString()
    console.log('========================================')
    console.log('USEEFFECT: Daily initialization useEffect fired at', timestamp)
    console.log('USEEFFECT: screen =', screen)
    console.log('USEEFFECT: activeSession?.id =', activeSession?.id)
    console.log('USEEFFECT: activeSession full object =', activeSession)
    console.log('USEEFFECT: condition check:', screen === 'videoSession' && !!activeSession)
    console.log('USEEFFECT: dailyCallRef.current exists =', !!dailyCallRef.current)

    if (screen === 'videoSession' && activeSession) {
      console.log('USEEFFECT: Calling startDailyCall()')
      startDailyCall()
    } else {
      console.log('USEEFFECT: Skipping startDailyCall - condition not met')
    }
    console.log('========================================')

    // NOTE: No cleanup function here - we rely on startDailyCall to destroy existing call
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, activeSession?.id])

  // Poll authoritative session phase every 10 seconds for mute enforcement
  useEffect(() => {
    if (screen !== 'videoSession' || !activeSession || !user) return

    const pollSessionState = async () => {
      try {
        console.log('[Session State Poll] Fetching authoritative phase for booking:', activeSession.id)

        // Query authoritative phase from session_states table (user-driven, not time-based)
        // Use .maybeSingle() to gracefully handle zero-row case during bootstrap
        const { data, error } = await supabase
          .from('session_states')
          .select('current_phase, transmission_started_at, reflection_started_at, validation_started_at, direction_started_at')
          .eq('booking_id', activeSession.id)
          .maybeSingle()

        if (error) {
          console.error('[Session State Poll] Error:', error)
          return
        }

        if (!data) {
          console.log('[Session State Poll] No session row yet (bootstrap in progress)')
          return
        }

        console.log('[Session State Poll] Authoritative phase:', data.current_phase)

        // Enforce mute rules for giver based on user-driven phase
        if (user.id === activeSession.giver_id && dailyCallRef.current) {
          // Giver is muted ONLY during transmission phase
          const shouldBeMuted = data.current_phase === 'transmission'

          console.log(`[Session State Poll] Giver mute enforcement: shouldBeMuted=${shouldBeMuted}, phase=${data.current_phase}`)

          if (shouldBeMuted) {
            // Transmission phase: force giver mute
            try {
              await dailyCallRef.current.setLocalAudio(false)
              console.log('[Session State Poll] Giver muted (transmission phase)')
            } catch (err) {
              console.error('[Session State Poll] Failed to mute giver:', err)
            }
          } else {
            // Other phases: giver can speak (but don't force unmute, respect user's choice)
            console.log('[Session State Poll] Giver can speak (not transmission phase)')
          }
        }
      } catch (err) {
        console.error('[Session State Poll] Exception:', err)
      }
    }

    // Poll immediately on mount
    pollSessionState()

    // Then poll every 10 seconds
    const interval = setInterval(pollSessionState, 10000)

    return () => clearInterval(interval)
  }, [screen, activeSession, user, dailyCallRef])

  // Check if a booking is joinable (at or after scheduled time, within 30-min window)
  const isSessionJoinable = (booking: Booking) => {
    const scheduledTime = new Date(booking.scheduled_time).getTime()
    const now = Date.now()
    const thirtyMinutesAfter = scheduledTime + 30 * 60 * 1000

    // Joinable exactly at scheduled time or after (if joining late)
    // Session ends 30 minutes after scheduled time regardless of when joined
    return now >= scheduledTime && now <= thirtyMinutesAfter
  }

  // Create receiver profile (minimal)
  const createReceiverProfile = async () => {
    if (!user) return

    // Validation
    if (!receiverName.trim()) {
      setProfileError('Please enter your name')
      return
    }

    setProfileLoading(true)
    setProfileError('')

    try {
      // Create/update profile with minimal fields
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          name: receiverName.trim(),
          tagline: receiverTagline.trim() || null,
          profile_picture_url: receiverProfilePictureUrl || null,
          age_verified_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      // Continue to discovery feed directly
      setScreen('discovery')
      setDiscoveryStep('feed')
      setDiscoveryFilters({ attentionType: null, category: null, availability: 'anytime' })

      // Reset form
      setReceiverName('')
      setReceiverTagline('')
      setReceiverProfilePictureUrl(undefined)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setProfileLoading(false)
    }
  }

  // Create giver profile
  const createGiverProfile = async () => {
    if (!user) return

    // Validation
    if (!giverName.trim()) {
      setProfileError('Please enter your name')
      return
    }
    if (getTotalSlots() === 0) {
      setProfileError('Please select at least one availability time slot')
      return
    }

    setProfileLoading(true)
    setProfileError('')

    try {
      // Check if user already has a giver profile
      const { data: existing } = await supabase
        .from('profiles_public')
        .select('id')
        .eq('id', user.id)
        .eq('is_giver', true)
        .maybeSingle()

      if (existing) {
        setProfileError('You already have a giver profile')
        setProfileLoading(false)
        return
      }

      // Upload video if recorded (optional)
      const videoUrl = recordedBlob ? await uploadVideo() : null

      // Create/update profile with timezone
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          name: giverName.trim(),
          tagline: giverTagline.trim() || null,
          bio: giverBio.trim() || null,
          video_url: videoUrl,
          is_giver: true,
          available: true,
          qualities_offered: giverQualities,
          timezone: giverTimezone,
          twitter_handle: twitterHandle.trim() || null,
          instagram_handle: instagramHandle.trim() || null,
          linkedin_handle: linkedinHandle.trim() || null,
          age_verified_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      // Timezone is already updated in profiles table above, no need for separate update

      // Refresh givers list and user's giver profile
      await fetchGivers()
      await fetchMyGiverProfile()

      // Go to create first listing
      setScreen('createListing')

      // Reset form
      setGiverName('')
      setGiverTagline('')
      setGiverBio('')
      setGiverQualities([])
      setRecordedBlob(null)
      setRecordedUrl(null)
      setVideoStep('prompt')
      setAvailabilitySlots([])
      setNewSlotDate('')
      setNewSlotTime('9:00')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to create profile')
    } finally {
      setProfileLoading(false)
    }
  }

  // Video recording functions
  const startRecording = async (retryCount = 0) => {
    console.log('[Camera] Starting recording, retry count:', retryCount)

    try {
      setVideoError('')
      console.log('[Camera] Requesting camera and microphone access...')

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      })

      console.log('[Camera] Camera access granted, stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })))
      setMediaStream(stream)

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'
      console.log('[Camera] Creating MediaRecorder with mimeType:', mimeType)

      const recorder = new MediaRecorder(stream, { mimeType })

      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          console.log('[Camera] Data chunk received:', e.data.size, 'bytes')
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        console.log('[Camera] Recording stopped, total chunks:', chunks.length)
        const blob = new Blob(chunks, { type: 'video/webm' })
        console.log('[Camera] Created blob:', blob.size, 'bytes')
        setRecordedBlob(blob)
        setRecordedUrl(URL.createObjectURL(blob))
        setVideoStep('preview')
        // Stop all tracks
        stream.getTracks().forEach(track => {
          console.log('[Camera] Stopping track:', track.kind)
          track.stop()
        })
        setMediaStream(null)
      }

      recorder.onerror = (e) => {
        console.error('[Camera] MediaRecorder error:', e)
        setVideoError('Recording failed. Please try again.')
      }

      setMediaRecorder(recorder)
      console.log('[Camera] Starting recorder...')
      recorder.start()
      setIsRecording(true)
      setVideoStep('recording')
      setRecordingTime(0)
      console.log('[Camera] Recording started successfully')
    } catch (err: unknown) {
      const error = err as Error & { name?: string }
      console.error('[Camera] Error:', {
        name: error.name,
        message: error.message,
        error: err
      })

      // If permission denied, prompt user and allow retry
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setVideoError('Camera permission needed. Please allow access and click Try Again.')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setVideoError('No camera found. Please check your device.')
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setVideoError('Camera is in use by another app. Please close other apps and try again.')
      } else {
        setVideoError(`Camera error: ${error.message || 'Unknown error'}. Please try again.`)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const retakeVideo = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    setRecordedBlob(null)
    setRecordedUrl(null)
    setVideoStep('prompt')
    setRecordingTime(0)
  }

  const uploadVideo = async (): Promise<string | null> => {
    if (!recordedBlob || !user) return null

    const fileName = `${user.id}-${Date.now()}.webm`
    const { data, error } = await supabase.storage
      .from('videos')
      .upload(fileName, recordedBlob, {
        contentType: 'video/webm',
        upsert: true
      })

    if (error) {
      console.error('Upload error:', error)
      throw new Error('Failed to upload video')
    }

    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(data.path)

    return urlData.publicUrl
  }

  // Recording timer
  useEffect(() => {
    let interval: number
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 90) {
            stopRecording()
            return 90
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl)
      }
    }
  }, [])

  useEffect(() => {
    if (user && needsAuth && returnToScreen) {
      setNeedsAuth(false)
      // If returning to payment, we need to create the booking first
      if (returnToScreen === 'payment' && selectedGiver && selectedBookingDate && selectedBookingTime) {
        createBooking()
      } else {
        setScreen(returnToScreen)
      }
      setReturnToScreen('')
    }
  }, [user, needsAuth, returnToScreen, selectedGiver, selectedBookingDate, selectedBookingTime])

  // Update video preview when mediaStream changes
  useEffect(() => {
    console.log('[Camera] useEffect: mediaStream changed:', mediaStream ? 'stream present' : 'no stream')
    if (previewVideoRef.current && mediaStream) {
      console.log('[Camera] useEffect: assigning stream to video element')
      previewVideoRef.current.srcObject = mediaStream
      // Try to play the video (might be blocked by autoplay policy)
      previewVideoRef.current.play().catch(err => {
        console.warn('[Camera] useEffect: autoplay failed (this is usually OK if muted):', err)
      })
    } else if (previewVideoRef.current && !mediaStream) {
      console.log('[Camera] useEffect: clearing video element')
      previewVideoRef.current.srcObject = null
    }
  }, [mediaStream])

  // Fetch selected giver's available slots when viewing their profile
  useEffect(() => {
    if (selectedGiver) {
      fetchGiverAvailableSlots(selectedGiver.id).then(slots => {
        setSelectedGiverSlots(slots)
      })
    } else {
      setSelectedGiverSlots([])
    }
  }, [selectedGiver, fetchGiverAvailableSlots])

  // Populate profile form when navigating to userProfile screen
  useEffect(() => {
    if (screen === 'userProfile' && myGiverProfile) {
      setGiverName(myGiverProfile.name || '')
      setGiverTagline(myGiverProfile.tagline || '')
      setGiverRate(myGiverProfile.rate_per_30 || 15)
      setGiverBio(myGiverProfile.bio || '')
      setGiverQualities(myGiverProfile.qualities_offered || [])
    }
  }, [screen, myGiverProfile])

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
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    background: colors.bgPrimary,
    color: colors.textPrimary,
    minHeight: '100vh',
    maxWidth: '560px',
    margin: '0 auto',
  }

  const screenStyle: React.CSSProperties = {
    padding: spacing.lg,
    paddingBottom: '100px',
    minHeight: '100vh',
  }

  const btnStyle: React.CSSProperties = {
    padding: `${spacing.md} ${spacing.xl}`,
    borderRadius: radius.button,
    fontSize: typography.base,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    width: '100%',
    minHeight: '48px',
    background: colors.accent,
    color: '#000000',
    marginBottom: spacing.lg,
    letterSpacing: '0.01em',
    transition: 'all 0.15s ease',
  }

  const btnSecondaryStyle: React.CSSProperties = {
    ...btnStyle,
    background: 'transparent',
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
    fontWeight: 500,
  }

  const cardStyle: React.CSSProperties = {
    background: colors.bgCard,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.card,
    padding: spacing.xl,
    marginBottom: spacing.xl,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
  }

  const navStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: '560px',
    background: 'rgba(10, 10, 10, 0.95)',
    backdropFilter: 'blur(10px)',
    borderTop: `1px solid rgba(255, 255, 255, 0.05)`,
    padding: `${spacing.md} ${spacing.lg}`,
    display: 'flex',
    justifyContent: 'space-around',
  }

  const Nav = () => (
    <>
      <nav style={navStyle}>
        {[
          { id: 'browse', icon: '🔍', label: 'Find' },
          ...(myGiverProfile ? [] : [{ id: 'giverIntro', icon: '🌱', label: 'Offer' }]),
          { id: 'sessions', icon: '📅', label: 'Bookings' },
          { id: 'userProfile', icon: '⚙️', label: 'Profile' },
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
    </>
  )

  const SignOutButton = () => user ? (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        // Force sign out by clearing all storage and reloading
        // This bypasses any Supabase auth.signOut() issues
        localStorage.clear()
        sessionStorage.clear()
        window.location.href = '/'
      }}
      style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        padding: '8px 16px',
        background: colors.bgSecondary,
        border: `1px solid ${colors.border}`,
        borderRadius: '3px',
        color: colors.textPrimary,
        cursor: 'pointer',
        fontSize: '0.9rem',
      }}
    >
      Sign Out
    </button>
  ) : null

  // Role Selection Screen (Unified Signup)
  if (screen === 'roleSelection') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
          <SignOutButton />

          {/* MYCA Logo */}
          <img
            src="/myca-logo.webp"
            alt="Myca"
            style={{
              width: '120px',
              height: 'auto',
              marginBottom: '30px'
            }}
          />

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '15px' }}>
            What are you here for?
          </h2>
          <p style={{ fontSize: '0.9rem', color: colors.textSecondary, maxWidth: '360px', lineHeight: 1.6, marginBottom: '15px' }}>
            You can always change this later
          </p>

          {/* Age Verification */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              marginBottom: '30px',
            }}
          >
            <input
              type="checkbox"
              checked={ageVerified}
              onChange={(e) => setAgeVerified(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                cursor: 'pointer',
                accentColor: colors.accent
              }}
            />
            <span style={{ fontSize: '0.85rem', color: colors.textSecondary, textAlign: 'left' }}>
              I confirm I'm 18+
            </span>
          </label>

          <div style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {/* Receive sessions */}
            <button
              style={{
                ...cardStyle,
                cursor: ageVerified ? 'pointer' : 'not-allowed',
                padding: '20px',
                textAlign: 'left',
                border: `1px solid ${colors.border}`,
                transition: 'all 0.2s',
                opacity: ageVerified ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (ageVerified) {
                  e.currentTarget.style.borderColor = colors.accent
                  e.currentTarget.style.background = colors.accentSoft
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border
                e.currentTarget.style.background = colors.bgCard
              }}
              onClick={() => {
                if (!ageVerified) return

                // Check if user has completed receiver profile
                if (user) {
                  supabase
                    .from('profiles_public')
                    .select('name')
                    .eq('id', user.id)
                    .maybeSingle()
                    .then(({ data }) => {
                      if (data?.name) {
                        // User has profile → go to discovery feed
                        setDiscoveryStep('feed')
                        setDiscoveryFilters({ attentionType: null, category: null, availability: 'anytime' })
                        setScreen('discovery')
                      } else {
                        // New user → create profile
                        setScreen('receiverProfile')
                      }
                    })
                }
              }}
              disabled={!ageVerified}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '5px' }}>
                Book time
              </div>
              <div style={{ fontSize: '0.85rem', color: colors.textSecondary, lineHeight: 1.5 }}>
                Find someone for an uninterrupted conversation
              </div>
            </button>

            {/* Give sessions */}
            <button
              style={{
                ...cardStyle,
                cursor: ageVerified ? 'pointer' : 'not-allowed',
                padding: '20px',
                textAlign: 'left',
                border: `1px solid ${colors.border}`,
                transition: 'all 0.2s',
                opacity: ageVerified ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (ageVerified) {
                  e.currentTarget.style.borderColor = colors.accent
                  e.currentTarget.style.background = colors.accentSoft
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border
                e.currentTarget.style.background = colors.bgCard
              }}
              onClick={() => {
                if (!ageVerified) return
                setScreen('giverIntro')
              }}
              disabled={!ageVerified}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '5px' }}>
                Offer time
              </div>
              <div style={{ fontSize: '0.85rem', color: colors.textSecondary, lineHeight: 1.5 }}>
                Offer focused conversation. Get paid
              </div>
            </button>

            {/* Both */}
            <button
              style={{
                ...cardStyle,
                cursor: ageVerified ? 'pointer' : 'not-allowed',
                padding: '20px',
                textAlign: 'left',
                border: `1px solid ${colors.border}`,
                transition: 'all 0.2s',
                opacity: ageVerified ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (ageVerified) {
                  e.currentTarget.style.borderColor = colors.accent
                  e.currentTarget.style.background = colors.accentSoft
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border
                e.currentTarget.style.background = colors.bgCard
              }}
              onClick={() => {
                if (!ageVerified) return
                // For "both", start with receiver profile since it's simpler
                setScreen('receiverProfile')
              }}
              disabled={!ageVerified}
            >
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.textPrimary, marginBottom: '5px' }}>
                Both
              </div>
              <div style={{ fontSize: '0.85rem', color: colors.textSecondary, lineHeight: 1.5 }}>
                Book and offer time
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'welcome') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative', minHeight: '90vh' }}>
          <SignOutButton />

          {/* MYCA Logo */}
          <img
            src="/myca-logo.webp"
            alt="Myca"
            style={{
              width: '200px',
              height: 'auto',
              marginBottom: spacing.xxl,
              opacity: 0.95
            }}
          />

          <h1 style={{
            fontSize: typography.xl,
            fontWeight: 600,
            color: colors.textPrimary,
            maxWidth: '480px',
            lineHeight: 1.4,
            marginBottom: spacing.lg,
            letterSpacing: '-0.02em'
          }}>
            Get understood first.
          </h1>
          <p style={{
            fontSize: typography.sm,
            fontWeight: 400,
            color: colors.textSecondary,
            maxWidth: '420px',
            lineHeight: 1.8,
            marginBottom: spacing.xxl,
            marginTop: spacing.sm
          }}>
            You speak first without interruption.<br />
            They reflect back what they heard.<br />
            Then the conversation opens.
          </p>
          <div style={{ width: '100%', maxWidth: '360px', marginTop: spacing.md }}>
            <button style={btnStyle} onClick={() => setScreen('browse')}>Get heard</button>
            <button
              style={btnSecondaryStyle}
              onClick={() => {
                // If user already has a giver profile, go to manage listings
                // Otherwise, go straight to listing form
                if (myGiverProfile) {
                  setScreen('manageListings')
                } else {
                  setScreen('createListing')
                }
              }}
            >
              Become available
            </button>
            <p style={{
              fontSize: typography.sm,
              color: colors.textMuted,
              marginTop: spacing.lg,
              textAlign: 'center'
            }}>
              Most people can do both.
            </p>
            {!user && (
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                  fontSize: typography.sm,
                  padding: 0,
                  marginTop: spacing.lg,
                  opacity: 0.7
                }}
                onClick={() => setNeedsAuth(true)}
              >
                Sign in
              </button>
            )}
          </div>

          {/* Three-step section */}
          <div style={{
            marginTop: '64px',
            maxWidth: '480px',
            width: '100%'
          }}>
            {/* Step 1 */}
            <div style={{ marginBottom: spacing.xl }}>
              <h3 style={{ fontSize: typography.lg, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs }}>
                Speak first
              </h3>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                You begin without interruption.
              </p>
            </div>

            {/* Step 2 */}
            <div style={{ marginBottom: spacing.xl }}>
              <h3 style={{ fontSize: typography.lg, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs }}>
                Be reflected back
              </h3>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                Your holder repeats back what they heard.
              </p>
            </div>

            {/* Step 3 */}
            <div style={{ marginBottom: spacing.xl }}>
              <h3 style={{ fontSize: typography.lg, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs }}>
                Continue with clarity
              </h3>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                Then the conversation opens.
              </p>
            </div>

            {/* Closing paragraph */}
            <p style={{
              fontSize: typography.sm,
              color: colors.textSecondary,
              lineHeight: 1.6,
              marginTop: spacing.lg,
              textAlign: 'center'
            }}>
              Your attention has weight. When you have room, make yourself available.
            </p>
          </div>

          {user && <Nav />}
        </div>
      </div>
    )
  }

  // DEBUG ROUTE: Raw bookings data (dev-only)
  if (import.meta.env.DEV && screen === 'debug-bookings') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <button
            onClick={() => setScreen('sessions')}
            style={{ marginBottom: '20px', padding: '10px', cursor: 'pointer' }}
          >
            ← Back to Sessions
          </button>
          <h2 style={{ fontSize: typography.xl, marginBottom: spacing.lg }}>Debug: Raw Bookings Data</h2>
          <div style={{
            fontSize: typography.xs,
            fontFamily: 'monospace',
            background: colors.bgSecondary,
            padding: spacing.md,
            borderRadius: '3px',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            <div style={{ marginBottom: spacing.md, color: colors.accent }}>
              User ID: {user?.id}
            </div>
            <div style={{ marginBottom: spacing.md, color: colors.accent }}>
              Total Bookings: {userBookings.length}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ADMIN ROUTE: Email Events Audit Trail (dev-only)
  if (import.meta.env.DEV && screen === 'emailEvents') {
    // Fetch email events on mount
    useEffect(() => {
      const fetchEmailEvents = async () => {
        console.log('[Email Events] start, filter:', emailEventsFilter || '(none)')
        setEmailEventsLoading(true)
        setEmailEventsError(null)
        setEmailEvents([]) // Reset to empty array

        try {
          // Explicit column selection to catch missing columns early
          let query = supabase
            .from('email_events')
            .select('id,created_at,booking_id,event,recipient,role,provider,provider_message_id,http_status,success,error_message')
            .order('created_at', { ascending: false })
            .limit(50)

          // Filter by booking_id if provided
          if (emailEventsFilter) {
            query = query.eq('booking_id', emailEventsFilter)
          }

          console.log('[Email Events] executing query...')
          const { data, error } = await query

          if (error) {
            console.error('[Email Events] error:', error)
            console.error('[Email Events] error details:', JSON.stringify(error, null, 2))

            throw new Error('Unable to load email events right now.')
          }

          // Never assume data is an array
          const events = Array.isArray(data) ? data : []
          console.log('[Email Events] ok count:', events.length)

          setEmailEvents(events)
        } catch (err) {
          console.error('[Email Events] error:', err)

          // Comprehensive error message for UI
          let errorMsg = 'Unable to load email events right now.'
          if (err instanceof Error) {
            errorMsg = err.message
          }

          setEmailEventsError(errorMsg)
          setEmailEvents([]) // Ensure empty array on error
        } finally {
          setEmailEventsLoading(false)
          console.log('[Email Events] fetch complete')
        }
      }

      fetchEmailEvents()
    }, [emailEventsFilter])

    return (
      <ErrorBoundary>
        <div style={containerStyle}>
          <div style={{ ...screenStyle, position: 'relative' }}>
            <button
              onClick={() => {
                setScreen('sessions')
                setEmailEventsFilter('')
                window.location.hash = '#/sessions'
              }}
              style={{ marginBottom: '20px', padding: '10px', cursor: 'pointer' }}
            >
              ← Back to Sessions
            </button>

            <h1 style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              marginBottom: '10px',
              color: colors.textPrimary
            }}>
              Email Events
            </h1>

          <p style={{
            fontSize: '0.9rem',
            marginBottom: '20px',
            color: colors.textMuted
          }}>
            Email audit trail - all send attempts with provider details
          </p>

          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Filter by booking ID (optional)"
              value={emailEventsFilter}
              onChange={(e) => setEmailEventsFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                background: colors.bgSecondary,
                color: colors.textPrimary,
                fontSize: '0.9rem'
              }}
            />
          </div>

          {emailEventsLoading && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: colors.textMuted,
              fontSize: '1rem'
            }}>
              Loading email events...
            </div>
          )}

          {emailEventsError && (
            <div style={{
              padding: '20px',
              marginBottom: '20px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444'
            }}>
              <strong>Error:</strong> {emailEventsError}
            </div>
          )}

          {!emailEventsLoading && !emailEventsError && (
            <>
              <div style={{ fontSize: '0.85rem', marginBottom: '20px', color: colors.textMuted }}>
                Showing {emailEvents.length} event{emailEvents.length !== 1 ? 's' : ''}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {Array.isArray(emailEvents) && emailEvents.map((event) => {
                  // Safe property access with fallbacks
                  const eventId = event?.id || Math.random().toString()
                  const eventName = event?.event || 'unknown'
                  const eventRole = event?.role || 'unknown'
                  const eventSuccess = event?.success === true
                  const createdAt = event?.created_at || new Date().toISOString()

                  return (
                    <div
                      key={eventId}
                      style={{
                        background: colors.bgSecondary,
                        padding: '15px',
                        borderRadius: '8px',
                        borderLeft: `4px solid ${eventSuccess ? '#10b981' : '#ef4444'}`
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div>
                          <strong style={{ color: colors.accent }}>
                            {eventName}
                          </strong>
                          {' '}→ {eventRole}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                          {new Date(createdAt).toLocaleString()}
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem', marginBottom: '5px' }}>
                        <strong>Recipient:</strong> {event?.recipient || 'N/A'}
                      </div>

                      <div style={{ fontSize: '0.85rem', marginBottom: '5px' }}>
                        <strong>Status:</strong>{' '}
                        <span style={{ color: eventSuccess ? '#10b981' : '#ef4444' }}>
                          {eventSuccess ? '✓ Success' : '✗ Failed'}
                        </span>
                        {' '}(HTTP {event?.http_status || 'N/A'})
                      </div>

                      {event?.provider_message_id && (
                        <div style={{ fontSize: '0.85rem', marginBottom: '5px' }}>
                          <strong>Message ID:</strong> {event.provider_message_id}
                        </div>
                      )}

                      {event?.error_message && (
                        <div style={{
                          fontSize: '0.85rem',
                          marginTop: '10px',
                          padding: '10px',
                          background: colors.bgPrimary,
                          borderRadius: '4px',
                          color: '#ef4444'
                        }}>
                          <strong>Error:</strong> {event.error_message}
                        </div>
                      )}

                      <div style={{
                        fontSize: '0.75rem',
                        marginTop: '10px',
                        color: colors.textMuted
                      }}>
                        Booking: {event?.booking_id || 'N/A'}
                      </div>
                    </div>
                  )
                })}

                {emailEvents.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: colors.textMuted }}>
                    No email events found
                  </div>
                )}
              </div>
            </>
          )}
          </div>
        </div>
      </ErrorBoundary>
    )
  }

  // Receiver Profile Creation (Minimal)
  if (screen === 'receiverProfile') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <SignOutButton />

          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <img
              src="/myca-logo.webp"
              alt="Myca"
              style={{
                width: '100px',
                height: 'auto',
                margin: '0 auto 25px'
              }}
            />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '10px' }}>Quick profile</h2>
            <p style={{ color: colors.textSecondary, fontSize: '0.95rem', lineHeight: 1.6 }}>
              Just the basics so givers know who they're talking to
            </p>
          </div>

          {profileError && (
            <div style={{ padding: '15px', background: `${colors.error}22`, border: `1px solid ${colors.error}`, borderRadius: '3px', marginBottom: '20px', color: colors.error }}>
              {profileError}
            </div>
          )}

          {/* Profile Photo */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
              Profile photo <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
            </label>
            <ImageUpload
              onUpload={async (publicUrl) => {
                setReceiverProfilePictureUrl(publicUrl)
              }}
              currentImageUrl={receiverProfilePictureUrl}
              bucketName="profile-pictures"
              maxSizeMB={5}
              aspectRatio="circle"
              initials={(receiverName?.[0] || user?.email?.[0] || '?').toUpperCase()}
            />
          </div>

          {/* Name */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
              Name <span style={{ color: colors.accent }}>*</span>
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Your name"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '3px',
                border: `1px solid ${colors.border}`,
                background: colors.bgSecondary,
                color: colors.textPrimary,
                fontSize: '1rem'
              }}
            />
          </div>

          {/* One-liner (Optional) */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
              One-liner <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              value={receiverTagline}
              onChange={(e) => setReceiverTagline(e.target.value)}
              placeholder="e.g., Designer figuring things out"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '3px',
                border: `1px solid ${colors.border}`,
                background: colors.bgSecondary,
                color: colors.textPrimary,
                fontSize: '1rem'
              }}
              maxLength={80}
            />
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '5px' }}>
              {receiverTagline.length}/80 characters
            </p>
          </div>

          <button
            style={{
              ...btnStyle,
              opacity: profileLoading ? 0.7 : 1,
              cursor: profileLoading ? 'not-allowed' : 'pointer',
              marginBottom: '15px'
            }}
            onClick={createReceiverProfile}
            disabled={profileLoading}
          >
            {profileLoading ? 'Saving...' : 'Continue to browse'}
          </button>

          {/* Removed "Skip for now" button - profile creation now required before browsing */}

          <Nav />
        </div>
      </div>
    )
  }

  // Seeker Discovery Flow (Part 5)
  if (screen === 'discovery') {
    // Profile check handled at entry points (Book time, Find a person buttons)
    // No need for additional guard here - entry points already verify profile exists

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
          <SignOutButton />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button
              onClick={() => {
                if (discoveryStep === 'availability') {
                  setScreen('browse')
                } else if (discoveryStep === 'feed') {
                  setDiscoveryStep('availability')
                }
              }}
              style={{ width: '40px', height: '40px', borderRadius: '3px', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}
            >
              ←
            </button>
            <div style={{ width: '40px' }} />
          </div>

          {/* Category and mode selection removed - givers offer themselves, not expertise */}

          {/* STEP 1: Availability */}
          {discoveryStep === 'availability' && (
            <div>
              <h3 style={{
                fontSize: typography.xl,
                marginBottom: spacing.lg,
                fontWeight: 600,
                letterSpacing: '-0.01em'
              }}>
                When do you need someone?
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.xl }}>
                {[
                  { value: 'now' as const, label: 'Available now', description: 'Next 2 hours' },
                  { value: 'today' as const, label: 'Available today', description: 'Rest of today' },
                  { value: 'week' as const, label: 'Available this week', description: 'Next 7 days' },
                  { value: 'anytime' as const, label: 'Any time', description: 'Show all available' }
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={async () => {
                      setDiscoveryFilters({ ...discoveryFilters, availability: option.value })

                      console.log('🔍 DEBUG: Starting discovery query...')

                      // Filter listings based on selections
                      const { data: allListings, error: listingsError } = await supabase
                        .from('listings')
                        .select(`
                          *,
                          profiles!inner (
                            id,
                            name,
                            tagline,
                            bio,
                            video_url,
                            qualities_offered,
                            twitter_handle,
                            instagram_handle,
                            linkedin_handle,
                            available,
                            total_sessions_completed,
                            profile_picture_url
                          )
                        `)
                        .eq('is_active', true)
                        // Mode filtering removed - modes only appear after validation as emergence verbs
                        .eq('profiles.is_giver', true)

                      console.log('📋 DEBUG: Listings query returned:', allListings?.length || 0, 'listings')
                      console.log('📋 DEBUG: Listings error:', listingsError)
                      console.log('📋 DEBUG: Listings data:', allListings)

                      // Get givers with available slots
                      const { data: availableGivers, error: availabilityError } = await supabase
                        .from('giver_availability')
                        .select('giver_id')
                        .eq('is_booked', false)

                      console.log('📅 DEBUG: Availability query returned:', availableGivers?.length || 0, 'slots')
                      console.log('📅 DEBUG: Availability error:', availabilityError)
                      console.log('📅 DEBUG: Availability data:', availableGivers)

                      const giverIdsWithAvailability = new Set(availableGivers?.map(slot => slot.giver_id) || [])
                      console.log('👥 DEBUG: Giver IDs with availability:', Array.from(giverIdsWithAvailability))

                      // Filter listings to only include givers with availability
                      let filtered = (allListings || []).filter(listing => {
                        const hasAvailability = giverIdsWithAvailability.has(listing.user_id)
                        console.log(`🔍 DEBUG: Checking listing ${listing.id} (user_id: ${listing.user_id}):`, hasAvailability)
                        return hasAvailability
                      })

                      console.log('✅ DEBUG: Filtered listings:', filtered.length)
                      console.log('✅ DEBUG: Filtered data:', filtered)

                      // Category filtering removed - givers offer themselves, not expertise categories

                      // Sort by: total sessions (primary), recency (secondary), then randomize
                      // Note: quality_score sorting removed - giver_metrics not accessible from client
                      filtered.sort((a, b) => {
                        // Primary: Total sessions (volume) - descending
                        const sessionsA = a.profiles?.total_sessions_completed ?? 0
                        const sessionsB = b.profiles?.total_sessions_completed ?? 0
                        if (sessionsB !== sessionsA) return sessionsB - sessionsA

                        // Secondary: Recency (updated_at) - descending
                        const dateA = new Date(a.updated_at).getTime()
                        const dateB = new Date(b.updated_at).getTime()
                        if (dateB !== dateA) return dateB - dateA

                        // Tertiary: Randomize for variety
                        return Math.random() - 0.5
                      })

                      setFilteredListings(filtered)
                      setCurrentFeedIndex(0)
                      setDiscoveryStep('feed')
                    }}
                    style={{
                      padding: spacing.md,
                      background: colors.bgCard,
                      border: `1px solid rgba(255, 255, 255, 0.06)`,
                      borderRadius: '3px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.accent
                      e.currentTarget.style.background = colors.accentSoft
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
                      e.currentTarget.style.background = colors.bgCard
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div style={{
                      fontSize: typography.base,
                      fontWeight: 600,
                      color: colors.textPrimary,
                      marginBottom: spacing.xs
                    }}>
                      {option.label}
                    </div>
                    <div style={{
                      fontSize: typography.sm,
                      color: colors.textSecondary,
                      lineHeight: 1.5
                    }}>
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time Filter Chips (shown when on feed) */}
          {discoveryStep === 'feed' && (
            <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg, flexWrap: 'wrap' }}>
              {[
                { value: 'now' as const, label: 'Now' },
                { value: 'today' as const, label: 'Today' },
                { value: 'week' as const, label: 'This week' },
                { value: 'anytime' as const, label: 'Any time' }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={async () => {
                    setDiscoveryFilters({ ...discoveryFilters, availability: filter.value })

                    console.log('🔍 DEBUG (Feed Filter): Starting discovery query...')

                    // Re-fetch and filter listings based on selection
                    const { data: allListings, error: listingsError } = await supabase
                      .from('listings')
                      .select(`
                        *,
                        profiles!inner (
                          id, name, tagline, bio, video_url, qualities_offered,
                          twitter_handle, instagram_handle, linkedin_handle,
                          available, total_sessions_completed, profile_picture_url
                        )
                      `)
                      .eq('is_active', true)
                      .eq('profiles.is_giver', true)

                    console.log('📋 DEBUG (Feed Filter): Listings query returned:', allListings?.length || 0, 'listings')
                    console.log('📋 DEBUG (Feed Filter): Listings error:', listingsError)
                    console.log('📋 DEBUG (Feed Filter): Listings data:', allListings)

                    // Get givers with available slots
                    const { data: availableGivers, error: availabilityError } = await supabase
                      .from('giver_availability')
                      .select('giver_id')
                      .eq('is_booked', false)

                    console.log('📅 DEBUG (Feed Filter): Availability query returned:', availableGivers?.length || 0, 'slots')
                    console.log('📅 DEBUG (Feed Filter): Availability error:', availabilityError)
                    console.log('📅 DEBUG (Feed Filter): Availability data:', availableGivers)

                    const giverIdsWithAvailability = new Set(availableGivers?.map(slot => slot.giver_id) || [])
                    console.log('👥 DEBUG (Feed Filter): Giver IDs with availability:', Array.from(giverIdsWithAvailability))

                    // Filter listings to only include givers with availability
                    let filtered = (allListings || []).filter(listing => {
                      const hasAvailability = giverIdsWithAvailability.has(listing.user_id)
                      console.log(`🔍 DEBUG (Feed Filter): Checking listing ${listing.id} (user_id: ${listing.user_id}):`, hasAvailability)
                      return hasAvailability
                    })

                    console.log('✅ DEBUG (Feed Filter): Filtered listings:', filtered.length)
                    console.log('✅ DEBUG (Feed Filter): Filtered data:', filtered)
                    // Apply time filtering based on selection
                    // (existing filtering logic would go here)

                    setFilteredListings(filtered as Listing[])
                    setCurrentFeedIndex(0)
                  }}
                  style={{
                    padding: `${spacing.xs} ${spacing.md}`,
                    borderRadius: '20px',
                    border: `1px solid ${discoveryFilters.availability === filter.value ? colors.accent : 'rgba(255, 255, 255, 0.08)'}`,
                    background: discoveryFilters.availability === filter.value ? colors.accentSoft : 'rgba(255, 255, 255, 0.03)',
                    color: discoveryFilters.availability === filter.value ? colors.accent : colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: typography.sm,
                    fontWeight: discoveryFilters.availability === filter.value ? 600 : 400,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}

          {/* STEP 4: Video Feed */}
          {discoveryStep === 'feed' && filteredListings.length > 0 && (
            <div>
              {(() => {
                const currentListing = filteredListings[currentFeedIndex]
                const giver = currentListing.profiles

                if (!giver) {
                  return (
                    <div style={{ ...cardStyle, textAlign: 'center' }}>
                      <p style={{ color: colors.textSecondary }}>Profile data not available</p>
                    </div>
                  )
                }

                return (
                  <div
                    style={{ position: 'relative', marginBottom: '20px' }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0]
                      e.currentTarget.dataset.startY = String(touch.clientY)
                    }}
                    onTouchEnd={(e) => {
                      const startY = parseFloat(e.currentTarget.dataset.startY || '0')
                      const endY = e.changedTouches[0].clientY
                      const deltaY = startY - endY

                      // Swipe up = next video (deltaY > 50)
                      if (deltaY > 50 && currentFeedIndex < filteredListings.length - 1) {
                        setCurrentFeedIndex(currentFeedIndex + 1)
                      }
                    }}
                  >
                    {/* TikTok-style Video Container */}
                    {giver.video_url ? (
                      <div
                        style={{
                          position: 'relative',
                          borderRadius: '3px',
                          overflow: 'hidden',
                          background: '#000',
                          cursor: 'pointer',
                          minHeight: '500px'
                        }}
                        onClick={() => {
                          setSelectedGiver(giver)
                          setSelectedListing(currentListing)
                          setScreen('publicGiverProfile')
                        }}
                      >
                        <video
                          src={giver.video_url || ''}
                          autoPlay
                          loop
                          muted
                          playsInline
                          style={{
                            width: '100%',
                            height: '500px',
                            objectFit: 'cover'
                          }}
                        />

                        {/* Overlay Info */}
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: spacing.lg,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
                          color: '#fff'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                            {/* Profile photo */}
                            <div style={{
                              width: '48px',
                              height: '48px',
                              borderRadius: '50%',
                              background: giver.profile_picture_url
                                ? `url(${giver.profile_picture_url}) center/cover`
                                : 'rgba(255,255,255,0.2)',
                              border: `2px solid rgba(255,255,255,0.3)`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: typography.md,
                              fontWeight: 600,
                              flexShrink: 0
                            }}>
                              {!giver.profile_picture_url && giver.name[0].toUpperCase()}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <h3 style={{
                                fontSize: typography.lg,
                                margin: 0,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.xs
                              }}>
                                {giver.name}
                                {(giver.twitter_handle || giver.instagram_handle || giver.linkedin_handle) && (
                                  <span style={{ fontSize: typography.sm, opacity: 0.9 }}>✓</span>
                                )}
                              </h3>
                              <p style={{
                                fontSize: typography.sm,
                                margin: `${spacing.xs} 0 0 0`,
                                opacity: 0.85,
                                lineHeight: 1.4
                              }}>
                                {currentListing.description || currentListing.topic || giver.bio?.slice(0, 60) + '...' || 'Available now'}
                              </p>
                            </div>
                          </div>

                          <p style={{
                            fontSize: typography.xl,
                            fontWeight: 600,
                            margin: `${spacing.sm} 0 0 0`,
                            letterSpacing: '-0.01em'
                          }}>
                            ${(currentListing.price_cents / 100).toFixed(0)} per 25-min session
                          </p>
                          <p style={{
                            fontSize: typography.xs,
                            color: 'rgba(255,255,255,0.6)',
                            marginTop: spacing.xs
                          }}>
                            {BLOCK_MINUTES}-minute blocks
                          </p>
                        </div>

                        {/* Tap hint */}
                        <div style={{
                          position: 'absolute',
                          top: spacing.lg,
                          right: spacing.lg,
                          padding: `${spacing.xs} ${spacing.sm}`,
                          background: 'rgba(0,0,0,0.5)',
                          backdropFilter: 'blur(8px)',
                          borderRadius: '3px',
                          fontSize: typography.xs,
                          color: 'rgba(255,255,255,0.8)',
                          border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                          Tap to view profile
                        </div>
                      </div>
                    ) : (
                      <div style={{ ...cardStyle, textAlign: 'center', padding: '60px 20px', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedGiver(giver)
                          setSelectedListing(currentListing)
                          setScreen('publicGiverProfile')
                        }}
                      >
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', fontWeight: 600 }}>{giver.name}</h3>
                        <p style={{ color: colors.textSecondary, marginBottom: '10px' }}>
                          {currentListing.description || currentListing.topic || giver.bio || 'Available now'}
                        </p>
                        <p style={{ fontSize: '1.3rem', color: colors.accent, fontWeight: 600 }}>
                          ${(currentListing.price_cents / 100).toFixed(0)} per 25-min session
                        </p>
                        <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: '15px' }}>
                          Tap to view profile
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                      <button
                        onClick={() => {
                          if (!user) {
                            alert('Please sign in to book')
                            setScreen('welcome')
                          } else {
                            setSelectedListing(currentListing)
                            setSelectedGiver(giver)
                            setScreen('profile')
                          }
                        }}
                        style={{ ...btnStyle, flex: 1 }}
                      >
                        Book time
                      </button>
                    </div>

                    {/* Swipe indicator */}
                    {currentFeedIndex < filteredListings.length - 1 && (
                      <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>
                          ↑ Swipe up for next ({currentFeedIndex + 1} of {filteredListings.length})
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {discoveryStep === 'feed' && filteredListings.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.textSecondary, marginBottom: '30px', fontSize: '1.1rem' }}>
                No one available right now
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '280px', margin: '0 auto' }}>
                <button
                  style={{ ...btnSecondaryStyle, margin: 0, opacity: 0.5, cursor: 'not-allowed' }}
                  disabled
                >
                  Invite someone you trust <span style={{ fontSize: '0.85rem', marginLeft: '8px' }}>(Coming soon)</span>
                </button>
                <button
                  style={{ ...btnSecondaryStyle, margin: 0 }}
                  onClick={() => setScreen('giverIntro')}
                >
                  Offer time
                </button>
              </div>
            </div>
          )}

          {/* Old empty state button kept for back compatibility */}
          {discoveryStep === 'feed' && filteredListings.length === 0 && false && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <button
                style={btnStyle}
                onClick={() => setDiscoveryStep('attention')}
              >
                Start Over
              </button>
            </div>
          )}

          <Nav />
        </div>
      </div>
    )
  }

  // Helper: compute availability text from giver's availability slots
  const getGiverAvailabilityText = (availabilitySlots: Array<{ date: string; time: string; is_booked: boolean }> | null | undefined): string => {
    if (!availabilitySlots || availabilitySlots.length === 0) return ''

    const unbookedSlots = availabilitySlots.filter(slot => !slot.is_booked)
    if (unbookedSlots.length === 0) return ''

    const today = new Date().toISOString().split('T')[0]

    // Check for today
    const hasTodaySlot = unbookedSlots.some(slot => slot.date === today)
    if (hasTodaySlot) return 'Available today'

    // Find next available date
    const futureSlots = unbookedSlots
      .filter(slot => slot.date > today)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (futureSlots.length > 0) {
      // Use midday parse to avoid timezone weekday drift
      const nextDate = new Date(`${futureSlots[0].date}T12:00:00`)
      const dayName = nextDate.toLocaleDateString('en-US', { weekday: 'long' })
      return `Next available: ${dayName}`
    }

    return ''
  }

  if (screen === 'browse') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button onClick={() => setScreen('welcome')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <div style={{ width: '40px' }} />
          </div>

          {/* Saved filter toggle */}
          <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.lg }}>
            <button
              onClick={() => setShowSavedOnly(false)}
              style={{
                padding: `${spacing.xs} ${spacing.md}`,
                borderRadius: '3px',
                border: `1px solid ${!showSavedOnly ? colors.accent : 'rgba(255, 255, 255, 0.08)'}`,
                background: !showSavedOnly ? colors.accentSoft : 'rgba(255, 255, 255, 0.03)',
                color: !showSavedOnly ? colors.accent : colors.textSecondary,
                cursor: 'pointer',
                fontSize: typography.sm,
                fontWeight: !showSavedOnly ? 600 : 400,
                transition: 'all 0.15s ease'
              }}
            >
              All
            </button>
            <button
              onClick={() => setShowSavedOnly(true)}
              style={{
                padding: `${spacing.xs} ${spacing.md}`,
                borderRadius: '3px',
                border: `1px solid ${showSavedOnly ? colors.accent : 'rgba(255, 255, 255, 0.08)'}`,
                background: showSavedOnly ? colors.accentSoft : 'rgba(255, 255, 255, 0.03)',
                color: showSavedOnly ? colors.accent : colors.textSecondary,
                cursor: 'pointer',
                fontSize: typography.sm,
                fontWeight: showSavedOnly ? 600 : 400,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: typography.sm }}>♥</span>
              Saved {savedGiverIds.size > 0 && `(${savedGiverIds.size})`}
            </button>
          </div>

          {givers.filter(g => g.id !== user?.id && (!showSavedOnly || savedGiverIds.has(g.id))).map(giver => (
            <div key={giver.id} style={cardStyle} onClick={() => { setSelectedGiver(giver); setScreen('profile'); }}>
              <div style={{ display: 'flex', gap: spacing.lg, marginBottom: spacing.lg }}>
                {giver.video_url ? (
                  <div style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0,
                    border: `1px solid rgba(255, 255, 255, 0.08)`
                  }}>
                    <video
                      src={giver.video_url}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      muted
                      playsInline
                    />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(255,255,255,0.2)'
                      }}>
                        <div style={{
                          width: 0,
                          height: 0,
                          borderLeft: '8px solid rgba(255,255,255,0.9)',
                          borderTop: '5px solid transparent',
                          borderBottom: '5px solid transparent',
                          marginLeft: '2px'
                        }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '3px',
                    background: `linear-gradient(135deg, ${colors.accentSoft}, ${colors.bgSecondary})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: '2rem',
                    color: colors.accent,
                    flexShrink: 0,
                    border: `1px solid rgba(255, 255, 255, 0.08)`
                  }}>
                    {giver.name[0]}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: typography.lg,
                    marginBottom: spacing.xs,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs
                  }}>
                    {giver.name}
                    {(giver.twitter_handle || giver.instagram_handle || giver.linkedin_handle) && (
                      <span style={{
                        fontSize: typography.sm,
                        color: colors.accent,
                        fontWeight: 500,
                        opacity: 0.8
                      }}>
                        ✓
                      </span>
                    )}
                  </h3>
                  <p style={{
                    fontSize: typography.sm,
                    color: colors.textSecondary,
                    lineHeight: 1.5,
                    marginTop: spacing.xs
                  }}>
                    {giver.tagline}
                  </p>
                  {(giver.total_sessions_completed || 0) > 0 && (
                    <p style={{
                      fontSize: typography.xs,
                      color: colors.textMuted,
                      marginTop: spacing.xs
                    }}>
                      {giver.total_sessions_completed} booking{giver.total_sessions_completed === 1 ? '' : 's'} completed
                    </p>
                  )}
                </div>
              </div>
              {giver.bio && giver.bio.trim() && (
                <p style={{
                  fontSize: typography.sm,
                  color: colors.textSecondary,
                  lineHeight: 1.6,
                  marginBottom: spacing.md,
                  marginTop: spacing.xs
                }}>
                  {giver.bio.length > 120 ? `${giver.bio.slice(0, 120)}...` : giver.bio}
                </p>
              )}
              {(giver.qualities_offered || []).length > 0 && (
                <div style={{ marginBottom: spacing.md, marginTop: spacing.md }}>
                  {(giver.qualities_offered || []).slice(0, 3).map((q, i) => (
                    <span key={q} style={{
                      padding: `${spacing.xs} ${spacing.sm}`,
                      background: i === 0 ? colors.accentSoft : 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '3px',
                      fontSize: typography.xs,
                      color: i === 0 ? colors.accent : colors.textMuted,
                      marginRight: spacing.xs,
                      border: i === 0 ? 'none' : `1px solid rgba(255, 255, 255, 0.06)`
                    }}>
                      {q}
                    </span>
                  ))}
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: spacing.md,
                borderTop: `1px solid rgba(255, 255, 255, 0.04)`,
                marginTop: spacing.xs
              }}>
                {/* Multi-listing display */}
                {giver.listings && giver.listings.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                      {giver.listings.length} {giver.listings.length === 1 ? 'offering' : 'offerings'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                      ${Math.min(...giver.listings.map(l => l.price_cents / 100))} - ${Math.max(...giver.listings.map(l => l.price_cents / 100))} per 25-min session
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>${giver.rate_per_30} <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: '0.9rem' }}>per 25-min session</span></div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={(e) => toggleSaveGiver(giver.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.3rem',
                      padding: '4px',
                      color: savedGiverIds.has(giver.id) ? '#e74c3c' : colors.textMuted,
                    }}
                    title={savedGiverIds.has(giver.id) ? 'Remove from saved' : 'Save for later'}
                  >
                    {savedGiverIds.has(giver.id) ? '♥' : '♡'}
                  </button>
                  {getGiverAvailabilityText(giver.giver_availability) && (
                    <div style={{ fontSize: typography.sm, color: colors.textMuted }}>
                      {getGiverAvailabilityText(giver.giver_availability)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Empty state for saved filter */}
          {showSavedOnly && givers.filter(g => savedGiverIds.has(g.id)).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.textMuted }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>♡</div>
              <p style={{ marginBottom: '10px' }}>No saved hosts yet</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '20px' }}>
                Tap the heart on any host to save them for later.
              </p>
              <button
                style={{ ...btnSecondaryStyle, maxWidth: '150px' }}
                onClick={() => setShowSavedOnly(false)}
              >
                View All
              </button>
            </div>
          )}

          <Nav />
        </div>
      </div>
    )
  }

  // Public giver profile (shareable link, no login required)
  if (screen === 'publicGiverProfile') {
    if (!selectedGiver) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <p style={{ color: colors.textSecondary, marginTop: '20px' }}>Profile not found</p>
            <button style={{ ...btnStyle, marginTop: '20px' }} onClick={() => setScreen('welcome')}>
              Go to Home
            </button>
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, paddingBottom: '100px' }}>
          {/* Profile photo */}
          {selectedGiver.profile_picture_url && (
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: `url(${selectedGiver.profile_picture_url}) center/cover`,
              border: `3px solid ${colors.accent}`,
              margin: '0 auto 20px'
            }} />
          )}
          <h1 style={{ fontSize: '2rem', fontWeight: 600, textAlign: 'center', marginBottom: '10px' }}>
            {selectedGiver.name}
          </h1>
          {selectedGiver.tagline && (
            <p style={{ color: colors.textSecondary, textAlign: 'center', marginBottom: '30px' }}>
              {selectedGiver.tagline}
            </p>
          )}

          {/* Video */}
          {selectedGiver.video_url && (
            <div style={{ marginBottom: '30px' }}>
              <video
                src={selectedGiver.video_url}
                controls
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  borderRadius: '3px',
                  background: '#000'
                }}
              />
            </div>
          )}

          {/* Bio */}
          {selectedGiver.bio && (
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                About
              </h3>
              <p style={{ color: colors.textPrimary, lineHeight: 1.6, fontSize: '0.95rem' }}>
                {selectedGiver.bio}
              </p>
            </div>
          )}

          {/* Listings Menu (Multi-listing architecture) */}
          {selectedGiver.listings && selectedGiver.listings.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '15px', fontWeight: 600 }}>Offerings</h3>
              {selectedGiver.listings.map(listing => {
                return (
                  <div
                    key={listing.id}
                    style={{
                      ...cardStyle,
                      cursor: 'default',
                      marginBottom: '15px',
                      borderLeft: `3px solid ${colors.accent}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '6px', fontWeight: 600 }}>
                          {listing.topic}
                        </h4>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '15px' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 600, color: colors.textPrimary }}>
                          ${(listing.price_cents / 100).toFixed(0)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                          per 25-min session
                        </div>
                      </div>
                    </div>

                    {listing.description && (
                      <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>
                        {listing.description}
                      </p>
                    )}

                    {listing.categories && listing.categories.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {listing.categories.map(cat => {
                          const catInfo = CATEGORIES.find(c => c.value === cat)
                          return (
                            <span
                              key={cat}
                              style={{
                                padding: '4px 10px',
                                background: colors.bgSecondary,
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                color: colors.textSecondary
                              }}
                            >
                              {catInfo?.label || cat}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <button
                      style={{ ...btnStyle, width: '100%', marginTop: '10px', padding: '10px' }}
                      onClick={() => {
                        if (!user) {
                          setScreen('welcome')
                          alert('Please sign in to book a session')
                        } else {
                          setSelectedListing(listing)
                          setScreen('profile')
                        }
                      }}
                    >
                      Book This Offering
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Accountability Stats */}
          {(selectedGiver.total_sessions_completed || 0) > 0 && (
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                {selectedGiver.total_sessions_completed} booking{selectedGiver.total_sessions_completed === 1 ? '' : 's'} completed
              </p>
              {(selectedGiver.times_joined_late || 0) > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '4px' }}>
                  Joined late {selectedGiver.times_joined_late} time{selectedGiver.times_joined_late === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}

          {/* Available slots */}
          {selectedGiverSlots.length > 0 ? (
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontWeight: 600 }}>
                Available Times
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedGiverSlots.slice(0, 10).map(slot => (
                  <div
                    key={slot.id}
                    style={{
                      padding: '8px 12px',
                      background: colors.bgSecondary,
                      borderRadius: '3px',
                      fontSize: '0.85rem',
                      color: colors.textPrimary
                    }}
                  >
                    {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {' at '}
                    {formatTimeTo12Hour(slot.time)}
                  </div>
                ))}
              </div>
              {selectedGiverSlots.length > 10 && (
                <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: '10px' }}>
                  +{selectedGiverSlots.length - 10} more times available
                </p>
              )}
            </div>
          ) : (
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <p style={{ color: colors.textMuted }}>No availability at this time</p>
            </div>
          )}

          <button
            style={{ ...btnSecondaryStyle, width: '100%' }}
            onClick={() => setScreen('welcome')}
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'profile') {
    if (!selectedGiver) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <button
              onClick={() => setScreen('browse')}
              style={{
                padding: '10px 20px',
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                color: colors.textPrimary,
                cursor: 'pointer'
              }}
            >
              ← Back to Browse
            </button>
            <p style={{ color: colors.textSecondary, marginTop: '20px' }}>Profile not found</p>
          </div>
        </div>
      )
    }

    // Group slots by date
    const slotsByDate = selectedGiverSlots.reduce((acc, slot) => {
      const date = slot.date
      if (!acc[date]) acc[date] = []
      acc[date].push(slot.time)
      return acc
    }, {} as Record<string, string[]>)

    const availableDates = Object.keys(slotsByDate).sort()
    const selectedDateKey = selectedBookingDate?.toISOString().split('T')[0]
    const selectedDateSlots = selectedDateKey ? (slotsByDate[selectedDateKey] || []) : []

    // PRICING MODEL: Platform fee (15%) is ADDED ON TOP of giver's net price
    const basePrice = selectedListingForBooking
      ? selectedListingForBooking.price_cents / 100
      : (selectedGiver.rate_per_30 ?? 0)
    const activeMinutes = blocksBooked * ACTIVE_MINUTES_PER_BLOCK

    // Calculate NET amount (what giver receives)
    const netAmountCents = Math.round(basePrice * 100) * blocksBooked

    // Calculate GROSS amount (what receiver pays) - add 15% on top, round up
    const grossAmountCents = Math.ceil(netAmountCents / (1 - 0.15))
    const totalPrice = grossAmountCents / 100 // For display

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button onClick={() => setScreen('browse')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <button
              onClick={() => toggleSaveGiver(selectedGiver.id)}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: savedGiverIds.has(selectedGiver.id) ? 'rgba(231, 76, 60, 0.15)' : colors.bgSecondary,
                border: `1px solid ${savedGiverIds.has(selectedGiver.id) ? '#e74c3c' : colors.border}`,
                color: savedGiverIds.has(selectedGiver.id) ? '#e74c3c' : colors.textPrimary,
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
              title={savedGiverIds.has(selectedGiver.id) ? 'Remove from saved' : 'Save for later'}
            >
              {savedGiverIds.has(selectedGiver.id) ? '♥' : '♡'}
            </button>
          </div>

          <div style={{ marginBottom: '30px' }}>
            {selectedGiver.video_url ? (
              <div style={{
                width: '100%',
                aspectRatio: '16/9',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '20px'
              }}>
                <video
                  src={selectedGiver.video_url}
                  controls
                  playsInline
                  autoPlay
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
            ) : selectedGiver.profile_picture_url ? (
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `url(${selectedGiver.profile_picture_url}) center/cover`,
                border: `3px solid ${colors.accent}`,
                margin: '0 auto 20px'
              }} />
            ) : (
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${colors.accentSoft}, ${colors.bgSecondary})`,
                margin: '0 auto 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '2.5rem',
                color: colors.accent,
                border: `3px solid ${colors.accent}`,
              }}>
                {selectedGiver.name[0]}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '2rem', marginBottom: '10px', fontWeight: 600 }}>{selectedGiver.name}</h1>
              <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>{selectedGiver.tagline}</p>
              {/* Show listing count or fallback to single rate */}
              {selectedGiver.listings && selectedGiver.listings.length > 0 ? (
                <div style={{ fontSize: '1.1rem', color: colors.accent }}>
                  {selectedGiver.listings.length} {selectedGiver.listings.length === 1 ? 'offering' : 'offerings'} available
                </div>
              ) : selectedGiver.rate_per_30 ? (
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.accent }}>${selectedGiver.rate_per_30} <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: '1rem' }}>per 25-min session</span></div>
              ) : null}
            </div>
          </div>

          {/* Bio */}
          {selectedGiver.bio && (
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                About
              </h3>
              <p style={{ color: colors.textPrimary, lineHeight: 1.6, fontSize: '0.95rem' }}>
                {selectedGiver.bio}
              </p>
            </div>
          )}

          {/* Listings Menu (Multi-listing architecture) */}
          {selectedGiver.listings && selectedGiver.listings.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '15px', fontWeight: 600 }}>Offerings</h3>
              {selectedGiver.listings.map(listing => {
                return (
                  <div
                    key={listing.id}
                    style={{
                      ...cardStyle,
                      cursor: 'default',
                      marginBottom: '15px',
                      borderLeft: `3px solid ${colors.accent}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '6px', fontWeight: 600 }}>
                          {listing.topic}
                        </h4>
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '15px' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 600, color: colors.textPrimary }}>
                          ${(listing.price_cents / 100).toFixed(0)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                          per 25-min session
                        </div>
                      </div>
                    </div>

                    {listing.description && (
                      <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>
                        {listing.description}
                      </p>
                    )}

                    {listing.categories && listing.categories.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {listing.categories.map(cat => {
                          const catInfo = CATEGORIES.find(c => c.value === cat)
                          return (
                            <span
                              key={cat}
                              style={{
                                padding: '4px 10px',
                                background: colors.bgSecondary,
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                color: colors.textSecondary
                              }}
                            >
                              {catInfo?.label || cat}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    <button
                      style={{ ...btnStyle, width: '100%', marginTop: '10px', padding: '10px' }}
                      onClick={() => {
                        if (!user) {
                          setScreen('welcome')
                          alert('Please sign in to book a session')
                        } else {
                          setSelectedListing(listing)
                          setScreen('profile')
                        }
                      }}
                    >
                      Book This Offering
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Accountability Stats */}
          {(selectedGiver.total_sessions_completed || 0) > 0 && (
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                {selectedGiver.total_sessions_completed} booking{selectedGiver.total_sessions_completed === 1 ? '' : 's'} completed
              </p>
              {(selectedGiver.times_joined_late || 0) > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '4px' }}>
                  Joined late {selectedGiver.times_joined_late} time{selectedGiver.times_joined_late === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}

          <div style={{ ...cardStyle, cursor: 'default' }}>
            <h3 style={{ fontSize: typography.xl, marginBottom: spacing.lg, fontWeight: 600 }}>Book Time</h3>

            {/* Listing Selection (Multi-listing architecture) */}
            {selectedGiver.listings && selectedGiver.listings.length > 0 && (
              <>
                <p style={{ color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.base }}>
                  Select offering
                </p>
                <div style={{ marginBottom: spacing.lg }}>
                  {selectedGiver.listings.map(listing => {
                    const isSelected = selectedListingForBooking?.id === listing.id
                    return (
                      <div
                        key={listing.id}
                        onClick={() => setSelectedListingForBooking(listing)}
                        style={{
                          padding: spacing.md,
                          marginBottom: spacing.sm,
                          background: isSelected ? colors.accentSoft : colors.bgSecondary,
                          border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: typography.md, fontWeight: 600, marginBottom: '4px' }}>
                              {listing.topic || 'Offer'}
                            </div>
                          </div>
                          <div style={{ fontSize: typography.lg, fontWeight: 600, color: isSelected ? colors.accent : colors.textPrimary }}>
                            ${(listing.price_cents / 100).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Single 30-min block - extensions happen in-session */}

            {availableDates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: spacing.xxl, color: colors.textSecondary }}>
                <p style={{ fontSize: typography.base }}>No available times this week</p>
                <p style={{ fontSize: typography.sm, marginTop: spacing.sm }}>Check back later</p>
              </div>
            ) : (
              <>
                <p style={{ color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.base }}>Date</p>
                <div style={{
                  display: 'flex',
                  gap: spacing.sm,
                  overflowX: 'auto',
                  paddingBottom: spacing.sm,
                  marginBottom: spacing.lg
                }}>
                  {availableDates.map(dateStr => {
                    const date = new Date(dateStr + 'T00:00:00')
                    const slots = slotsByDate[dateStr]
                    return (
                      <div
                        key={dateStr}
                        onClick={() => {
                          setSelectedBookingDate(date)
                          setSelectedBookingTime('')
                        }}
                        style={{
                          minWidth: '90px',
                          padding: `${spacing.md} ${spacing.sm}`,
                          background: selectedBookingDate?.toISOString().split('T')[0] === dateStr
                            ? colors.accentSoft : colors.bgSecondary,
                          border: `1px solid ${selectedBookingDate?.toISOString().split('T')[0] === dateStr
                            ? colors.accent : colors.border}`,
                          borderRadius: '3px',
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          fontSize: typography.sm,
                          fontWeight: 600,
                          color: selectedBookingDate?.toISOString().split('T')[0] === dateStr
                            ? colors.accent : colors.textPrimary
                        }}>
                          {formatDate(date)}
                        </div>
                        <div style={{ fontSize: typography.xs, color: colors.textMuted, marginTop: '4px' }}>
                          {slots.length} slot{slots.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedBookingDate && selectedDateSlots.length > 0 && (
                  <>
                    <p style={{ color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.base }}>
                      Time ({selectedGiver?.timezone ? getTimezoneAbbr(selectedGiver.timezone) : 'ET'})
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: spacing.sm, marginBottom: spacing.lg }}>
                      {selectedDateSlots.map(t => (
                        <div
                          key={t}
                          onClick={() => setSelectedBookingTime(t)}
                          style={{
                            padding: spacing.sm,
                            background: selectedBookingTime === t ? colors.accentSoft : colors.bgSecondary,
                            border: `1px solid ${selectedBookingTime === t ? colors.accent : colors.border}`,
                            borderRadius: '3px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            color: selectedBookingTime === t ? colors.accent : colors.textPrimary,
                            fontSize: typography.base,
                          }}
                        >
                          {formatTimeTo12Hour(t)}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {bookingError && (
                  <div style={{
                    padding: spacing.sm,
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '3px',
                    color: '#f87171',
                    marginBottom: spacing.md,
                    fontSize: typography.sm
                  }}>
                    {bookingError}
                  </div>
                )}

                {/* Price Summary */}
                <div style={{ padding: `${spacing.lg} 0`, borderTop: `1px solid ${colors.border}` }}>
                  <div style={{ marginBottom: spacing.sm, color: colors.textSecondary, fontSize: typography.sm }}>
                    {activeMinutes} minutes
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: spacing.sm,
                    borderTop: `1px solid ${colors.border}`,
                    marginTop: spacing.xs
                  }}>
                    <span style={{ fontSize: typography.lg, fontWeight: 600 }}>Total</span>
                    <span style={{ fontSize: typography.xl, fontWeight: 600, color: colors.accent }}>${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  style={{
                    ...btnStyle,
                    opacity: (selectedBookingDate && selectedBookingTime && !bookingLoading) ? 1 : 0.5,
                    cursor: (selectedBookingDate && selectedBookingTime && !bookingLoading) ? 'pointer' : 'not-allowed'
                  }}
                  onClick={() => {
                    if (selectedBookingDate && selectedBookingTime) {
                      if (!user) {
                        setReturnToScreen('payment')
                        setNeedsAuth(true)
                      } else {
                        createBooking()
                      }
                    }
                  }}
                  disabled={!selectedBookingDate || !selectedBookingTime || bookingLoading}
                >
                  {bookingLoading ? 'Processing...' : 'Continue to Payment'}
                </button>
              </>
            )}
          </div>
          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'payment' && currentBooking && selectedGiver && selectedBookingDate) {
    // PRICING MODEL: amount_cents stores gross amount (what receiver pays)
    const grossAmountCents = currentBooking.amount_cents
    const netAmountCents = Math.floor(grossAmountCents * (1 - 0.15))
    const platformFeeCents = grossAmountCents - netAmountCents
    const amountAfterCreditsCents = Math.max(0, grossAmountCents - creditsAppliedCents)
    const totalPayment = amountAfterCreditsCents / 100
    const hasCredits = creditsAppliedCents > 0

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: spacing.md,
      background: colors.bgSecondary,
      border: `1px solid ${colors.border}`,
      borderRadius: '3px',
      color: colors.textPrimary,
      fontSize: typography.md,
      boxSizing: 'border-box'
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xxl }}>
            <button
              onClick={() => {
                setScreen('profile')
                setCurrentBooking(null)
              }}
              style={{ width: '40px', height: '40px', borderRadius: '3px', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}
            >←</button>
            <h2 style={{ fontSize: typography.xl, fontWeight: 600 }}>Payment</h2>
            <div style={{ width: '40px' }} />
          </div>

          {/* Booking Summary */}
          <div style={{
            ...cardStyle,
            cursor: 'default',
            marginBottom: spacing.xl
          }}>
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
              <div style={{
                width: '70px',
                height: '70px',
                borderRadius: '3px',
                background: `linear-gradient(135deg, ${colors.accentSoft}, ${colors.bgSecondary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: typography.xl,
                color: colors.accent,
              }}>
                {selectedGiver.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: typography.lg, marginBottom: '6px', fontWeight: 600 }}>{selectedGiver.name}</h3>
                <p style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                  {formatFullDate(selectedBookingDate, selectedBookingTime)}
                </p>
              </div>
            </div>

            {/* What happens first */}
            <div style={{
              marginBottom: spacing.lg,
              padding: spacing.md,
              background: colors.bgSecondary,
              borderRadius: '3px'
            }}>
              <h4 style={{
                fontSize: typography.base,
                fontWeight: 600,
                color: colors.textPrimary,
                marginBottom: spacing.sm
              }}>
                What happens first
              </h4>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing.xs }}>
                You will have the floor first.
              </p>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6, marginBottom: spacing.xs }}>
                You will not be interrupted.
              </p>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6 }}>
                Your holder will reflect back what they heard before the conversation opens.
              </p>
            </div>

            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: spacing.md }}>
              {/* Base rate */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                <span style={{ fontSize: typography.sm, color: colors.textSecondary }}>Session rate</span>
                <span style={{ fontSize: typography.sm, color: colors.textSecondary }}>${(netAmountCents / 100).toFixed(2)}</span>
              </div>

              {/* Platform fee */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <span style={{ fontSize: typography.sm, color: colors.textSecondary }}>Platform fee</span>
                <span style={{ fontSize: typography.sm, color: colors.textSecondary }}>${(platformFeeCents / 100).toFixed(2)}</span>
              </div>

              {/* Total (before credits) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: spacing.xs, borderTop: `1px solid ${colors.border}`, marginBottom: hasCredits ? spacing.sm : '0' }}>
                <span style={{ fontSize: typography.base, color: colors.textPrimary, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: typography.lg, color: colors.accent, fontWeight: 600 }}>${(grossAmountCents / 100).toFixed(2)}</span>
              </div>
              {hasCredits && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm, color: '#10b981', fontSize: typography.base }}>
                    <span>Credits applied</span>
                    <span>-${(creditsAppliedCents / 100).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: spacing.sm, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span style={{ fontSize: typography.base }}>Due now</span>
                    <span style={{ fontSize: typography.lg, color: colors.accent }}>${totalPayment.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Available Credits Display */}
          {totalCreditsCents > 0 && (
            <div style={{
              ...cardStyle,
              cursor: 'default',
              marginBottom: spacing.xl,
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)'
            }}>
              <h3 style={{ fontSize: typography.base, fontWeight: 600, color: '#10b981', marginBottom: spacing.xs }}>Credits Available</h3>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, marginBottom: spacing.xs }}>
                ${(totalCreditsCents / 100).toFixed(2)} in credits
              </p>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                {creditsAppliedCents > 0
                  ? `Applied $${(creditsAppliedCents / 100).toFixed(2)} to this booking`
                  : `Automatically applied when booking`
                }
              </p>
            </div>
          )}

          {/* Payment Form */}
          <div style={{ ...cardStyle, cursor: 'default' }}>
            <h3 style={{ fontSize: typography.lg, marginBottom: spacing.lg, fontWeight: 600 }}>
              {amountAfterCreditsCents > 0 ? 'Payment' : 'Confirm'}
            </h3>

            {bookingError && (
              <div style={{
                padding: spacing.sm,
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '3px',
                color: '#f87171',
                marginBottom: spacing.lg,
                fontSize: typography.sm
              }}>
                {bookingError}
              </div>
            )}

            {amountAfterCreditsCents > 0 ? (
              <>
                <div style={{ marginBottom: spacing.md }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>Card number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>Expiry</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      placeholder="MM/YY"
                      maxLength={5}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>CVC</label>
                    <input
                      type="text"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="123"
                      maxLength={4}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <p style={{ fontSize: typography.sm, color: colors.textMuted, marginBottom: spacing.lg, textAlign: 'center' }}>
                  Held until session completes
                </p>
              </>
            ) : (
              <div style={{
                padding: spacing.md,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '3px',
                marginBottom: spacing.lg,
                textAlign: 'center'
              }}>
                <p style={{ fontSize: typography.base, color: '#10b981', fontWeight: 600, marginBottom: '6px' }}>
                  Covered by credits
                </p>
                <p style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                  No payment required
                </p>
              </div>
            )}

            {/* Cancellation Policy Notice */}
            <div style={{
              padding: spacing.md,
              background: 'rgba(201, 166, 107, 0.08)',
              border: `1px solid ${colors.border}`,
              borderRadius: '3px',
              marginBottom: spacing.lg,
            }}>
              <p style={{ fontSize: typography.base, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: 600 }}>
                Cancellation
              </p>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
                If you cancel: Your payment goes to the giver. No refund.
              </p>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
                If giver cancels: You receive a full refund.
              </p>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.5, marginTop: spacing.xs }}>
                By booking, you agree to these terms.
              </p>
            </div>

            <button
              style={{
                ...btnStyle,
                opacity: bookingLoading ? 0.7 : 1,
                cursor: bookingLoading ? 'not-allowed' : 'pointer'
              }}
              onClick={processPayment}
              disabled={bookingLoading}
            >
              {bookingLoading ? 'Processing...' : amountAfterCreditsCents > 0 ? `Pay $${totalPayment.toFixed(2)}` : 'Confirm Booking'}
            </button>

            {amountAfterCreditsCents > 0 && (
              <p style={{ fontSize: typography.xs, color: colors.textMuted, marginTop: spacing.md, textAlign: 'center' }}>
                Test card: 4242 4242 4242 4242
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'confirmation') {
    const isPendingApproval = currentBooking?.status === 'pending_approval'

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{
            width: '100px',
            height: '100px',
            background: isPendingApproval ? 'rgba(201, 166, 107, 0.2)' : colors.accentSoft,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xxl,
            fontSize: '3rem',
            color: colors.accent,
          }}>{isPendingApproval ? '⏳' : '✓'}</div>
          <h1 style={{ fontSize: typography.xl, marginBottom: spacing.md, fontWeight: 600 }}>
            {isPendingApproval ? 'Awaiting Approval' : 'Confirmed'}
          </h1>
          <p style={{ color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.base }}>
            {isPendingApproval
              ? `Waiting for ${selectedGiver?.name} to approve`
              : `Booking with ${selectedGiver?.name} confirmed`
            }
          </p>
          {selectedBookingDate && selectedBookingTime && (
            <p style={{ color: colors.accent, fontSize: typography.lg, fontWeight: 500, marginBottom: spacing.xxl }}>
              {formatFullDate(selectedBookingDate, selectedBookingTime)}
            </p>
          )}
          <p style={{ color: colors.textMuted, fontSize: typography.sm, marginBottom: spacing.xxl, maxWidth: '320px', lineHeight: 1.6 }}>
            {isPendingApproval
              ? `You'll be notified when ${selectedGiver?.name} approves. They have until the scheduled time to respond.`
              : "You'll receive a reminder before your call. The video room opens at your scheduled time."
            }
          </p>
          <p style={{ fontSize: typography.sm, color: colors.textMuted, marginBottom: spacing.lg, maxWidth: '320px', lineHeight: 1.6 }}>
            If you cancel, payment goes to {selectedGiver?.name}. If they cancel, you're refunded.
          </p>
          {currentBooking && (
            <>
              <button
                disabled={!isSessionJoinable(currentBooking)}
                style={{
                  ...btnStyle,
                  maxWidth: '320px',
                  marginBottom: spacing.sm,
                  opacity: isSessionJoinable(currentBooking) ? 1 : 0.5,
                  cursor: isSessionJoinable(currentBooking) ? 'pointer' : 'not-allowed',
                }}
                onClick={() => currentBooking && isSessionJoinable(currentBooking) && joinSession(currentBooking)}
              >
                Join Session
              </button>
              {!isSessionJoinable(currentBooking) && (
                <p style={{ color: colors.textMuted, fontSize: typography.sm, marginBottom: spacing.lg, maxWidth: '320px' }}>
                  Opens at scheduled time
                </p>
              )}
            </>
          )}
          <button
            style={{ ...btnStyle, maxWidth: '320px' }}
            onClick={() => {
              setScreen('sessions')
              setSelectedBookingDate(null)
              setSelectedBookingTime('')
              setCurrentBooking(null)
            }}
          >
            View Bookings
          </button>
          <button
            style={{ ...btnSecondaryStyle, maxWidth: '320px', marginTop: spacing.sm }}
            onClick={() => {
              setScreen('browse')
              setSelectedBookingDate(null)
              setSelectedBookingTime('')
              setCurrentBooking(null)
            }}
          >
            Browse
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'giverIntro') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
          <SignOutButton />

          <img
            src="/myca-logo.webp"
            alt="Myca"
            style={{
              width: '120px',
              height: 'auto',
              marginBottom: '40px'
            }}
          />

          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '30px' }}>
            Offer time
          </h2>

          <p style={{ fontSize: '1.05rem', color: colors.textSecondary, maxWidth: '380px', lineHeight: 1.7, marginBottom: '60px' }}>
            You offer uninterrupted time. You check for understanding, then move forward in the direction you allow.
          </p>

          <div style={{ width: '100%', maxWidth: '320px' }}>
            <button style={btnStyle} onClick={() => setScreen('createListing')}>Create your first offer</button>
            <button style={{ ...btnSecondaryStyle, marginBottom: 0 }} onClick={() => setScreen('giverCode')}>
              How it works <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>(optional)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'giverCode') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <SignOutButton />

          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <img
              src="/myca-logo.webp"
              alt="Myca"
              style={{
                width: '100px',
                height: 'auto',
                margin: '0 auto 25px'
              }}
            />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: 0 }}>What This Is</h2>
          </div>

          <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '25px' }}>
            You're about to define what kinds of attention you're willing to give—and what that's worth.
          </p>

          <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '25px' }}>
            Some people will book you to listen. Some will book you to strategize. Some will book you to teach, or to challenge, or just to talk. You decide which you offer, in what categories, at what price.
          </p>

          <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '30px' }}>
            Every session has a contract. They know what they're getting. You know what you're giving. The system handles the rest—timing, payment, endings.
          </p>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px', background: `linear-gradient(135deg, rgba(201, 166, 107, 0.05), ${colors.bgCard})` }}>
            <h3 style={{ fontSize: '1.1rem', color: colors.textPrimary, marginBottom: '15px', fontWeight: 600 }}>
              What Makes This Work
            </h3>
            <ul style={{ color: colors.textSecondary, lineHeight: 1.8, margin: '0 0 0 20px', padding: 0 }}>
              <li>You show up fully for the time you've agreed to.</li>
              <li>You stay inside the contract. If they booked listening, you listen. If they booked strategy, you strategize. The mode is the promise.</li>
              <li>You let the system be the boundary. You don't negotiate time. You don't chase payment. You don't owe anything beyond the call.</li>
              <li>You release it when it ends. You gave your attention. That was the gift. Now it's done.</li>
            </ul>
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.1rem', color: colors.textPrimary, marginBottom: '15px', fontWeight: 600 }}>
              Why People Do This
            </h3>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0' }}>
              Some want to monetize expertise they already have. Some want to be useful in ways their job doesn't allow. Some want to learn what it's like inside other people's lives. Some want structure around something they've been doing for free.
              <br /><br />
              Whatever your reason, that's the right one.
            </p>
          </div>

          {!user ? (
            <Auth onBack={() => setScreen('giverIntro')} />
          ) : (
            <>
              <button style={btnStyle} onClick={() => setScreen('give')}>Create Your First Offer</button>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textSecondary,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  marginTop: '15px',
                  textDecoration: 'underline'
                }}
                onClick={() => setScreen('giverIntro')}
              >
                Back
              </button>
            </>
          )}

          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'editVideo') {
    if (!user || !myGiverProfile) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <p style={{ color: colors.textSecondary }}>Please set up your giver profile first.</p>
            <button style={btnStyle} onClick={() => setScreen('giverIntro')}>Get Started</button>
            <Nav />
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button onClick={() => setScreen('userProfile')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Video & Availability</h2>
            <div style={{ width: '40px' }} />
          </div>

          {/* Video Section */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Your Introduction Video
            </label>

            {myGiverProfile.video_url && !recordedUrl && videoStep === 'done' && (
              <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '3px', padding: '20px', marginBottom: '15px' }}>
                {videoJustSaved && (
                  <div style={{
                    padding: '12px 15px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '8px',
                    color: '#22c55e',
                    marginBottom: '15px',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>✓</span>
                    <span>Video saved successfully!</span>
                  </div>
                )}
                <video
                  src={myGiverProfile.video_url}
                  controls
                  style={{ width: '100%', maxHeight: '400px', borderRadius: '12px', marginBottom: '15px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={async () => {
                      if (confirm('Delete your current video? You can record a new one.')) {
                        await supabase.from('profiles').update({ video_url: null }).eq('id', user.id)
                        setMyGiverProfile({ ...myGiverProfile, video_url: null })
                        setVideoJustSaved(false)
                      }
                    }}
                    style={{ ...btnSecondaryStyle, flex: 1, background: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)', color: '#f87171' }}
                  >
                    Delete Video
                  </button>
                  <button
                    onClick={() => {
                      setVideoStep('prompt')
                      setVideoJustSaved(false)
                    }}
                    style={{ ...btnStyle, flex: 1 }}
                  >
                    Record New Video
                  </button>
                </div>
              </div>
            )}

            {(!myGiverProfile.video_url || videoStep !== 'done') && (
              <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '3px', padding: '20px' }}>
                {videoStep === 'done' && (
                  <button onClick={() => setVideoStep('prompt')} style={{ width: '100%', ...btnStyle }}>
                    Record Introduction Video
                  </button>
                )}

                {videoStep === 'prompt' && (
                  <div>
                    <p style={{ fontSize: '0.95rem', color: colors.textSecondary, marginBottom: '20px', lineHeight: '1.6' }}>
                      Ready to record your introduction video? Share who you are and why you want to give presence.
                    </p>
                    <div style={{ marginBottom: '20px' }}>
                      <video ref={previewVideoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: '400px', borderRadius: '12px', background: '#000' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setVideoStep('done')} style={{ ...btnSecondaryStyle, flex: 1 }}>Cancel</button>
                      <button onClick={() => startRecording()} style={{ ...btnStyle, flex: 1 }}>Start Recording</button>
                    </div>
                  </div>
                )}

                {videoStep === 'recording' && (
                  <div>
                    {/* Guidance banner - show for first 15-30 seconds */}
                    {recordingTime < 30 && (
                      <div style={{
                        padding: '12px 15px',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '8px',
                        color: colors.accent,
                        marginBottom: '15px',
                        fontSize: '0.85rem',
                        lineHeight: '1.5'
                      }}>
                        <div style={{ fontWeight: 600, marginBottom: '6px' }}>💡 What to say:</div>
                        <ul style={{ margin: 0, paddingLeft: '20px' }}>
                          <li>Who you are</li>
                          <li>What kind of presence you offer</li>
                          <li>Why you want to be here</li>
                        </ul>
                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary, marginTop: '8px' }}>
                          Keep it natural - aim for 15-30 seconds
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '20px' }}>
                      <video ref={previewVideoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: '400px', borderRadius: '12px', background: '#000' }} />
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: colors.accent, marginBottom: '5px' }}>
                        {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>Recording...</div>
                    </div>
                    <button onClick={stopRecording} style={{ width: '100%', ...btnStyle, background: '#dc2626' }}>Stop Recording</button>
                  </div>
                )}

                {videoStep === 'preview' && recordedUrl && (
                  <div>
                    <div style={{ marginBottom: '20px' }}>
                      <video src={recordedUrl} controls style={{ width: '100%', maxHeight: '400px', borderRadius: '12px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={retakeVideo} style={{ ...btnSecondaryStyle, flex: 1 }}>Retake</button>
                      <button
                        onClick={async () => {
                          const url = await uploadVideo()
                          if (url) {
                            console.log('✅ Video saved successfully:', url)
                            await supabase.from('profiles').update({ video_url: url }).eq('id', user.id)
                            setMyGiverProfile({ ...myGiverProfile, video_url: url })
                            setVideoStep('done')
                            setRecordedUrl(null)
                            setProfileError('') // Clear any errors
                            setVideoJustSaved(true) // Show success message
                            // Auto-hide success message after 5 seconds
                            setTimeout(() => setVideoJustSaved(false), 5000)
                          }
                        }}
                        style={{ ...btnStyle, flex: 1 }}
                      >
                        Save Video
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Availability Section */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Your Availability <span style={{ color: colors.textMuted }}>({availabilitySlots.length} slots)</span>
            </label>

            <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '3px', padding: '20px' }}>
              {/* Bulk Add */}
              <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: `2px solid ${colors.border}` }}>
                <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>Quick Add</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Date</label>
                    <input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>End Date</label>
                    <input type="date" value={bulkEndDate} min={bulkStartDate} onChange={(e) => setBulkEndDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Time</label>
                    <select value={bulkStartTime} onChange={(e) => setBulkStartTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem' }}>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0')
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>{formatTimeTo12Hour(`${hour}:00`)}</option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>{formatTimeTo12Hour(`${hour}:30`)}</option>
                        ]
                      })}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>End Time</label>
                    <select value={bulkEndTime} onChange={(e) => setBulkEndTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem' }}>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0')
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>{formatTimeTo12Hour(`${hour}:00`)}</option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>{formatTimeTo12Hour(`${hour}:30`)}</option>
                        ]
                      })}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>Days</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <div key={index} onClick={() => toggleBulkDay(index)} style={{ padding: '10px 0', borderRadius: '3px', textAlign: 'center', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, background: bulkSelectedDays.has(index) ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.has(index) ? colors.bgPrimary : colors.textSecondary, border: `1px solid ${bulkSelectedDays.has(index) ? colors.accent : colors.border}`, minWidth: 0 }}>
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={addBulkAvailabilitySlots} disabled={bulkSelectedDays.size === 0} style={{ width: '100%', padding: '12px', borderRadius: '3px', border: 'none', background: bulkSelectedDays.size > 0 ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.size > 0 ? colors.bgPrimary : colors.textMuted, cursor: bulkSelectedDays.size > 0 ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: 600 }}>
                  Add these times
                </button>
              </div>

              {/* Current slots list */}
              {availabilitySlots.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>Upcoming open times ({availabilitySlots.length})</h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {availabilitySlots.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((slot) => (
                      <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: colors.bgSecondary, borderRadius: '3px', marginBottom: '8px', fontSize: '0.85rem' }}>
                        <span style={{ color: colors.textPrimary }}>
                          {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTimeTo12Hour(slot.time)}
                        </span>
                        <button onClick={() => removeAvailabilitySlot(slot.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={async () => {
                    if (confirm('Remove all availability slots?')) {
                      for (const slot of availabilitySlots) {
                        await supabase.from('giver_availability').delete().eq('id', slot.id)
                      }
                      setAvailabilitySlots([])
                    }
                  }} style={{ ...btnSecondaryStyle, marginTop: '15px', background: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)', color: '#f87171' }}>
                    Clear All Slots
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Giver Commitment Policy */}
          <div style={{
            padding: '15px',
            background: 'rgba(201, 166, 107, 0.1)',
            border: `1px solid ${colors.accent}`,
            borderRadius: '12px',
            marginBottom: '20px',
          }}>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              When someone books your time, they pay upfront.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If you cancel, they are refunded and you receive nothing.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If they cancel, platform policy applies.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5, marginTop: '8px' }}>
              Only open times you can reliably keep.
            </p>
          </div>

          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'manageAvailability') {
    if (!user || !myGiverProfile) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <p style={{ color: colors.textSecondary }}>Please set up your giver profile first</p>
            <button style={btnStyle} onClick={() => setScreen('giverIntro')}>Get Started</button>
            <Nav />
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xxl }}>
            <button onClick={() => setScreen('manageListings')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: typography.xl, fontWeight: 600 }}>Availability</h2>
            <div style={{ width: '40px' }} />
          </div>

          {/* Trial Stage Display */}
          <div style={{
            background: colors.bgCard,
            border: `1px solid ${colors.borderEmphasis}`,
            borderRadius: '3px',
            padding: spacing.md,
            marginBottom: spacing.xl,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: typography.base, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs }}>
              Trial
            </div>
            <div style={{ fontSize: typography.sm, color: colors.textSecondary }}>
              1 session per day
            </div>
          </div>

          {/* Availability Section */}
          <div style={{ marginBottom: spacing.xxl }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.base }}>
              Next open times
            </label>

            <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '3px', padding: spacing.lg }}>
              {/* Bulk Add */}
              <div style={{ marginBottom: spacing.xl, paddingBottom: spacing.lg, borderBottom: `1px solid ${colors.border}` }}>
                <h4 style={{ fontSize: typography.base, color: colors.textPrimary, marginBottom: spacing.sm, fontWeight: 600 }}>Quick Add</h4>
                <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: typography.sm, color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Date</label>
                    <input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: typography.sm, color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>End Date</label>
                    <input type="date" value={bulkEndDate} min={bulkStartDate} onChange={(e) => setBulkEndDate(e.target.value)} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: typography.sm, color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Time</label>
                    <select value={bulkStartTime} onChange={(e) => setBulkStartTime(e.target.value)} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm }}>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0')
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>{formatTimeTo12Hour(`${hour}:00`)}</option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>{formatTimeTo12Hour(`${hour}:30`)}</option>
                        ]
                      })}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: typography.sm, color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>End Time</label>
                    <select value={bulkEndTime} onChange={(e) => setBulkEndTime(e.target.value)} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm }}>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0')
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>{formatTimeTo12Hour(`${hour}:00`)}</option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>{formatTimeTo12Hour(`${hour}:30`)}</option>
                        ]
                      })}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: spacing.md }}>
                  <label style={{ fontSize: typography.sm, color: colors.textSecondary, display: 'block', marginBottom: spacing.xs }}>Days</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: spacing.xs }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <div key={index} onClick={() => toggleBulkDay(index)} style={{ padding: `${spacing.sm} 0`, borderRadius: '3px', textAlign: 'center', cursor: 'pointer', fontSize: typography.xs, fontWeight: 500, background: bulkSelectedDays.has(index) ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.has(index) ? colors.bgPrimary : colors.textSecondary, border: `1px solid ${bulkSelectedDays.has(index) ? colors.accent : colors.border}`, minWidth: 0 }}>
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={addBulkAvailabilitySlots} disabled={bulkSelectedDays.size === 0} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: 'none', background: bulkSelectedDays.size > 0 ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.size > 0 ? colors.bgPrimary : colors.textMuted, cursor: bulkSelectedDays.size > 0 ? 'pointer' : 'not-allowed', fontSize: typography.base, fontWeight: 600 }}>
                  Add these times
                </button>
              </div>

              {/* Grouped slots list */}
              {availabilitySlots.length > 0 && (
                <div>
                  <h4 style={{ fontSize: typography.base, color: colors.textPrimary, marginBottom: spacing.sm, fontWeight: 600 }}>Your open times</h4>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {(() => {
                      // Filter to future dates only (including today)
                      const today = new Date().toISOString().split('T')[0]
                      const futureSlots = availabilitySlots.filter(slot => slot.date >= today)

                      // Group slots by date
                      const slotsByDay = futureSlots.reduce((acc, slot) => {
                        if (!acc[slot.date]) acc[slot.date] = []
                        acc[slot.date].push(slot)
                        return acc
                      }, {} as Record<string, typeof availabilitySlots>)

                      // Sort dates
                      const sortedDates = Object.keys(slotsByDay).sort()

                      // Get next 7 future days
                      const next7Days = sortedDates.slice(0, 7)
                      const additionalDays = sortedDates.slice(7)

                      return (
                        <>
                          {/* Next 7 days */}
                          {next7Days.map(date => (
                            <div key={date} style={{ marginBottom: spacing.md }}>
                              <div style={{ fontSize: typography.sm, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs }}>
                                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                              </div>
                              {slotsByDay[date].sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                                <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xs, paddingLeft: spacing.md, background: colors.bgSecondary, borderRadius: '3px', marginBottom: spacing.xs, fontSize: typography.sm }}>
                                  <span style={{ color: colors.textPrimary }}>{formatTimeTo12Hour(slot.time)}</span>
                                  <button onClick={() => removeAvailabilitySlot(slot.id)} style={{ padding: '4px 8px', borderRadius: '3px', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: typography.sm }}>✕</button>
                                </div>
                              ))}
                            </div>
                          ))}

                          {/* Show more for additional days */}
                          {additionalDays.length > 0 && (
                            <details style={{ marginTop: spacing.md }}>
                              <summary style={{ fontSize: typography.sm, color: colors.accent, cursor: 'pointer', marginBottom: spacing.sm }}>
                                Show {additionalDays.length} more {additionalDays.length === 1 ? 'day' : 'days'}
                              </summary>
                              {additionalDays.map(date => (
                                <div key={date} style={{ marginBottom: spacing.md }}>
                                  <div style={{ fontSize: typography.sm, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs }}>
                                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                  </div>
                                  {slotsByDay[date].sort((a, b) => a.time.localeCompare(b.time)).map(slot => (
                                    <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xs, paddingLeft: spacing.md, background: colors.bgSecondary, borderRadius: '3px', marginBottom: spacing.xs, fontSize: typography.sm }}>
                                      <span style={{ color: colors.textPrimary }}>{formatTimeTo12Hour(slot.time)}</span>
                                      <button onClick={() => removeAvailabilitySlot(slot.id)} style={{ padding: '4px 8px', borderRadius: '3px', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: typography.sm }}>✕</button>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </details>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Giver Commitment Policy */}
          <div style={{
            padding: spacing.md,
            background: 'rgba(201, 166, 107, 0.08)',
            border: `1px solid ${colors.border}`,
            borderRadius: '3px',
            marginBottom: spacing.lg,
          }}>
            <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
              When someone books, they pay upfront.
            </p>
            <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
              If you cancel, they are refunded and you receive nothing.
            </p>
            <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.5 }}>
              If they cancel, platform policy applies.
            </p>
            <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.5, marginTop: spacing.xs }}>
              Only open times you can reliably keep.
            </p>
          </div>

          {/* Clear All Slots */}
          {availabilitySlots.length > 0 && (
            <button onClick={async () => {
              if (confirm('Remove all slots?')) {
                for (const slot of availabilitySlots) {
                  await supabase.from('giver_availability').delete().eq('id', slot.id)
                }
                setAvailabilitySlots([])
              }
            }} style={{
              width: '100%',
              padding: spacing.sm,
              marginBottom: spacing.lg,
              background: 'transparent',
              border: `1px solid rgba(220,38,38,0.2)`,
              borderRadius: '3px',
              color: 'rgba(220,38,38,0.6)',
              cursor: 'pointer',
              fontSize: typography.sm,
              fontWeight: 400
            }}>
              Clear all slots
            </button>
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
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Create Account</h2>
              <div style={{ width: '40px' }} />
            </div>
            <Auth onBack={() => setScreen('giverCode')} />
          </div>
        </div>
      )
    }

    // If user already has a giver profile, redirect to editVideo for availability management
    if (myGiverProfile) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.textPrimary, marginBottom: '15px', fontSize: '1.1rem' }}>You already have a giver profile</p>
              <p style={{ color: colors.textSecondary, marginBottom: '30px' }}>Manage your video and availability from your profile settings</p>
              <button style={btnStyle} onClick={() => setScreen('editVideo')}>Availability & video</button>
              <button style={{ ...btnSecondaryStyle, marginTop: '10px' }} onClick={() => setScreen('manageListings')}>Back to Your rooms</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xxl }}>
            <button onClick={() => setScreen('giverCode')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: typography.xl, fontWeight: 600 }}>Create Profile</h2>
            <div style={{ width: '40px' }} />
          </div>
          <p style={{ color: colors.textSecondary, marginBottom: spacing.xxl }}>Share your presence with those who need it.</p>

          {profileError && (
            <div style={{
              padding: spacing.md,
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '3px',
              color: '#f87171',
              marginBottom: spacing.lg,
              fontSize: typography.sm
            }}>
              {profileError}
            </div>
          )}

          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.sm }}>Your name *</label>
            <input
              value={giverName}
              onChange={(e) => setGiverName(e.target.value)}
              style={{ width: '100%', padding: spacing.md, background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textPrimary, fontSize: typography.md, boxSizing: 'border-box' }}
              placeholder="How should people know you?"
            />
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.sm }}>Your tagline</label>
            <input
              value={giverTagline}
              onChange={(e) => setGiverTagline(e.target.value)}
              style={{ width: '100%', padding: spacing.md, background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '3px', color: colors.textPrimary, fontSize: typography.md, boxSizing: 'border-box' }}
              placeholder="One sentence about your presence..."
            />
          </div>

          <div style={{ marginBottom: spacing.xxl }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.sm }}>Your timezone *</label>
            <select
              value={giverTimezone}
              onChange={(e) => setGiverTimezone(e.target.value)}
              style={{
                width: '100%',
                padding: spacing.md,
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                color: colors.textPrimary,
                fontSize: typography.md,
                boxSizing: 'border-box'
              }}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: spacing.xs }}>
              Your availability times will be stored in this timezone
            </p>
          </div>

          {/* Bio/Background */}
          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.sm }}>
              Why do people leave clearer after talking to you? <span style={{ color: colors.textMuted }}>(optional, 500 char max)</span>
            </label>
            <textarea
              value={giverBio}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setGiverBio(e.target.value)
                }
              }}
              style={{
                width: '100%',
                padding: spacing.md,
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                color: colors.textPrimary,
                fontSize: typography.md,
                boxSizing: 'border-box',
                minHeight: '100px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              placeholder="Describe what kind of clarity, challenge, steadiness, or perspective you tend to bring."
            />
            <p style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: '6px', textAlign: 'right' }}>
              {giverBio.length}/500
            </p>
          </div>

          {/* Social Verification */}
          <div style={{ marginBottom: spacing.xxl }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.sm }}>
              Social Verification <span style={{ color: colors.textMuted }}>(optional)</span>
            </label>
            <p style={{ color: colors.textMuted, fontSize: typography.sm, marginBottom: spacing.md, lineHeight: 1.6 }}>
              Link your social profiles to build trust. You'll receive a "Verified ✓" badge when at least one is added.
            </p>

            {/* Twitter */}
            <div style={{ marginBottom: spacing.sm }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '6px', fontSize: typography.sm }}>
                Twitter / X
              </label>
              <input
                type="text"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                placeholder="@username"
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: typography.base,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Instagram */}
            <div style={{ marginBottom: spacing.sm }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '6px', fontSize: typography.sm }}>
                Instagram
              </label>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@username"
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: typography.base,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* LinkedIn */}
            <div style={{ marginBottom: spacing.sm }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '6px', fontSize: typography.sm }}>
                LinkedIn
              </label>
              <input
                type="text"
                value={linkedinHandle}
                onChange={(e) => setLinkedinHandle(e.target.value)}
                placeholder="linkedin.com/in/yourprofile"
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: typography.base,
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Video Recording Section */}
          <div style={{ marginBottom: spacing.xxl }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.sm, fontSize: typography.sm }}>
              Introduction video <span style={{ color: colors.textMuted }}>(optional, 15-30 seconds)</span>
            </label>

            {videoError && (
              <div style={{
                padding: spacing.sm,
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '3px',
                color: '#f87171',
                marginBottom: spacing.md,
                fontSize: typography.sm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: spacing.sm
              }}>
                <span>{videoError}</span>
                <button
                  onClick={() => startRecording()}
                  style={{
                    padding: `6px ${spacing.sm}`,
                    background: 'rgba(220, 38, 38, 0.2)',
                    border: '1px solid rgba(220, 38, 38, 0.4)',
                    borderRadius: '3px',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: typography.xs,
                    whiteSpace: 'nowrap'
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {videoStep === 'prompt' && (
              <div style={{
                background: colors.bgCard,
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                padding: spacing.lg,
                textAlign: 'center'
              }}>
                <div style={{
                  background: colors.accentSoft,
                  borderRadius: '3px',
                  padding: spacing.lg,
                  marginBottom: spacing.lg
                }}>
                  <p style={{
                    color: colors.textPrimary,
                    fontSize: typography.base,
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                    margin: 0
                  }}>
                    "In this space, my role is to offer presence without directing, fixing, or advancing an agenda. This is how I personally hold that."
                  </p>
                </div>
                <p style={{ color: colors.textSecondary, fontSize: typography.sm, marginBottom: spacing.lg }}>
                  Record a single take video sharing how you embody this. Be yourself.
                </p>
                <button
                  style={{
                    ...btnStyle,
                    maxWidth: '200px',
                    margin: '0 auto'
                  }}
                  onClick={() => startRecording()}
                >
                  Start Recording
                </button>
              </div>
            )}

            {videoStep === 'recording' && (
              <div style={{
                background: colors.bgCard,
                border: `1px solid ${colors.accent}`,
                borderRadius: '3px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16/9',
                  background: colors.bgSecondary,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  marginBottom: '20px'
                }}>
                  <video
                    autoPlay
                    muted
                    playsInline
                    ref={previewVideoRef}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)'
                    }}
                  />
                  {/* Recording indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '15px',
                    left: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(220, 38, 38, 0.9)',
                    padding: '8px 12px',
                    borderRadius: '3px'
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      background: '#fff',
                      borderRadius: '50%',
                      animation: 'pulse 1s infinite'
                    }} />
                    <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>
                      {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  {/* Time remaining */}
                  <div style={{
                    position: 'absolute',
                    top: '15px',
                    right: '15px',
                    background: 'rgba(0, 0, 0, 0.7)',
                    padding: '8px 12px',
                    borderRadius: '3px',
                    color: recordingTime >= 30 ? colors.success : colors.textSecondary,
                    fontSize: '0.85rem'
                  }}>
                    {90 - recordingTime}s left
                  </div>
                </div>
                <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '15px' }}>
                  {recordingTime < 30 ? `Keep going... ${30 - recordingTime}s until minimum` : 'Looking good! Stop when ready.'}
                </p>
                <button
                  style={{
                    ...btnStyle,
                    maxWidth: '200px',
                    margin: '0 auto',
                    background: recordingTime >= 30 ? colors.accent : colors.bgSecondary,
                    color: recordingTime >= 30 ? colors.bgPrimary : colors.textMuted
                  }}
                  onClick={stopRecording}
                  disabled={recordingTime < 30}
                >
                  Stop Recording
                </button>
              </div>
            )}

            {videoStep === 'preview' && recordedUrl && (
              <div style={{
                background: colors.bgCard,
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  marginBottom: '20px'
                }}>
                  <video
                    src={recordedUrl}
                    controls
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    style={{
                      ...btnSecondaryStyle,
                      flex: 1,
                      maxWidth: '150px'
                    }}
                    onClick={retakeVideo}
                  >
                    Retake
                  </button>
                  <button
                    style={{
                      ...btnStyle,
                      flex: 1,
                      maxWidth: '150px',
                      marginBottom: 0
                    }}
                    onClick={() => setVideoStep('done')}
                  >
                    Use This
                  </button>
                </div>
              </div>
            )}

            {videoStep === 'done' && recordedUrl && (
              <div style={{
                background: colors.bgCard,
                border: `1px solid ${colors.success}`,
                borderRadius: '3px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '100%',
                  aspectRatio: '16/9',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  marginBottom: '15px',
                  opacity: 0.8
                }}>
                  <video
                    src={recordedUrl}
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: colors.success }}>
                  <span style={{ fontSize: '1.2rem' }}>✓</span>
                  <span>Video ready</span>
                </div>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textMuted,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginTop: '10px',
                    textDecoration: 'underline'
                  }}
                  onClick={retakeVideo}
                >
                  Record a different video
                </button>
              </div>
            )}
          </div>

          {/* Availability Section - Calendar Based */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Availability * <span style={{ color: colors.textMuted }}>({getTotalSlots()} slots)</span>
            </label>

            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '3px',
              padding: '20px'
            }}>
              {/* Bulk Add Section */}
              <div style={{
                marginBottom: '25px',
                paddingBottom: '20px',
                borderBottom: `2px solid ${colors.border}`
              }}>
                <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>
                  Bulk add these times
                </h4>
                <p style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '15px' }}>
                  Add multiple time slots at once for selected days
                </p>

                {/* Date Range */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={bulkStartDate}
                      onChange={(e) => setBulkStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '3px',
                        border: `1px solid ${colors.border}`,
                        background: colors.bgSecondary,
                        color: colors.textPrimary,
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>
                      End Date
                    </label>
                    <input
                      type="date"
                      value={bulkEndDate}
                      min={bulkStartDate}
                      onChange={(e) => setBulkEndDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '3px',
                        border: `1px solid ${colors.border}`,
                        background: colors.bgSecondary,
                        color: colors.textPrimary,
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                {/* Time Range */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>
                      Start Time
                    </label>
                    <select
                      value={bulkStartTime}
                      onChange={(e) => setBulkStartTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '3px',
                        border: `1px solid ${colors.border}`,
                        background: colors.bgSecondary,
                        color: colors.textPrimary,
                        fontSize: '0.85rem'
                      }}
                    >
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0')
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>{formatTimeTo12Hour(`${hour}:00`)}</option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>{formatTimeTo12Hour(`${hour}:30`)}</option>
                        ]
                      })}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>
                      End Time
                    </label>
                    <select
                      value={bulkEndTime}
                      onChange={(e) => setBulkEndTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '3px',
                        border: `1px solid ${colors.border}`,
                        background: colors.bgSecondary,
                        color: colors.textPrimary,
                        fontSize: '0.85rem'
                      }}
                    >
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0')
                        return [
                          <option key={`${hour}:00`} value={`${hour}:00`}>{formatTimeTo12Hour(`${hour}:00`)}</option>,
                          <option key={`${hour}:30`} value={`${hour}:30`}>{formatTimeTo12Hour(`${hour}:30`)}</option>
                        ]
                      })}
                    </select>
                  </div>
                </div>

                {/* Day Selection */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '8px' }}>
                    Select Days
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Sun', index: 0 },
                      { label: 'Mon', index: 1 },
                      { label: 'Tue', index: 2 },
                      { label: 'Wed', index: 3 },
                      { label: 'Thu', index: 4 },
                      { label: 'Fri', index: 5 },
                      { label: 'Sat', index: 6 }
                    ].map(day => (
                      <div
                        key={day.index}
                        onClick={() => toggleBulkDay(day.index)}
                        style={{
                          flex: '1 1 40px',
                          minWidth: '45px',
                          padding: '8px 4px',
                          borderRadius: '3px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          background: bulkSelectedDays.has(day.index) ? colors.accent : colors.bgSecondary,
                          color: bulkSelectedDays.has(day.index) ? colors.bgPrimary : colors.textSecondary,
                          border: `1px solid ${bulkSelectedDays.has(day.index) ? colors.accent : colors.border}`,
                          transition: 'all 0.2s'
                        }}
                      >
                        {day.label}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={addBulkAvailabilitySlots}
                  disabled={bulkSelectedDays.size === 0}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '3px',
                    border: 'none',
                    background: bulkSelectedDays.size > 0 ? colors.accent : colors.bgSecondary,
                    color: bulkSelectedDays.size > 0 ? colors.bgPrimary : colors.textMuted,
                    cursor: bulkSelectedDays.size > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  Add Bulk Slots
                </button>
              </div>

              {/* Single Slot Add Section */}
              <div>
                <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>
                  Add Single Slot
                </h4>
                <p style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '15px' }}>
                  Add a specific date and time
                </p>

                {/* Add new slot */}
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '20px',
                flexWrap: 'wrap'
              }}>
                <input
                  type="date"
                  value={newSlotDate}
                  onChange={(e) => setNewSlotDate(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '150px',
                    padding: '12px',
                    borderRadius: '3px',
                    border: `1px solid ${colors.border}`,
                    background: colors.bgSecondary,
                    color: colors.textPrimary,
                    fontSize: '0.9rem'
                  }}
                />
                <select
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    padding: '12px',
                    borderRadius: '3px',
                    border: `1px solid ${colors.border}`,
                    background: colors.bgSecondary,
                    color: colors.textPrimary,
                    fontSize: '0.9rem'
                  }}
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0')
                    return [
                      <option key={`${hour}:00`} value={`${hour}:00`}>{formatTimeTo12Hour(`${hour}:00`)}</option>,
                      <option key={`${hour}:30`} value={`${hour}:30`}>{formatTimeTo12Hour(`${hour}:30`)}</option>
                    ]
                  })}
                </select>
                <button
                  onClick={addAvailabilitySlot}
                  disabled={!newSlotDate || !newSlotTime}
                  style={{
                    padding: '12px 20px',
                    borderRadius: '3px',
                    border: 'none',
                    background: colors.accent,
                    color: colors.bgPrimary,
                    cursor: newSlotDate && newSlotTime ? 'pointer' : 'not-allowed',
                    opacity: newSlotDate && newSlotTime ? 1 : 0.5,
                    fontSize: '0.9rem',
                    fontWeight: 500
                  }}
                >
                  Add
                </button>
              </div>
              </div>

              {/* List of added slots */}
              {availabilitySlots.length > 0 && (
                <div style={{
                  marginTop: '15px',
                  paddingTop: '15px',
                  borderTop: `1px solid ${colors.border}`
                }}>
                  <strong style={{ fontSize: '0.85rem', color: colors.textPrimary }}>Your availability:</strong>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {availabilitySlots.map((slot, index) => (
                      <div
                        key={slot.id || index}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: colors.bgSecondary,
                          borderRadius: '3px',
                          fontSize: '0.85rem'
                        }}
                      >
                        <span style={{ color: colors.textPrimary }}>
                          {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTimeWithTz(slot.time, giverTimezone)}
                        </span>
                        <button
                          onClick={() => removeAvailabilitySlot(slot.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: 'none',
                            background: 'transparent',
                            color: colors.textMuted,
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Giver Commitment Policy */}
          <div style={{
            padding: '15px',
            background: 'rgba(201, 166, 107, 0.1)',
            border: `1px solid ${colors.accent}`,
            borderRadius: '12px',
            marginBottom: '20px',
          }}>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              When someone books your time, they pay upfront.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If you cancel, they are refunded and you receive nothing.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If they cancel, platform policy applies.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5, marginTop: '8px' }}>
              Only open times you can reliably keep.
            </p>
          </div>

          <button
            style={{
              ...btnStyle,
              opacity: profileLoading ? 0.7 : 1,
              cursor: profileLoading ? 'not-allowed' : 'pointer'
            }}
            onClick={createGiverProfile}
            disabled={profileLoading}
          >
            {profileLoading ? 'Creating...' : 'Create Profile'}
          </button>
          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'payoutSetup') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <div style={{ width: '40px' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Set Up Payouts</h2>
            <div style={{ width: '40px' }} />
          </div>

          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: colors.accentSoft,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '2rem',
            }}>
              💳
            </div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '10px', fontWeight: 600 }}>
              Almost there!
            </h3>
            <p style={{ color: colors.textSecondary, maxWidth: '320px', margin: '0 auto' }}>
              Connect your bank account to receive payments from your bookings.
            </p>
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                background: '#635bff',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}>
                stripe
              </div>
              <div>
                <h4 style={{ fontSize: '1rem', marginBottom: '3px' }}>Powered by Stripe</h4>
                <p style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Secure payment processing</p>
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                <span style={{ color: colors.accent }}>You receive</span>
                <span style={{ color: colors.accent }}>
                  ${myGiverProfile?.rate_per_30}/session
                </span>
              </div>
            </div>
          </div>

          {stripeConnectError && (
            <div style={{
              padding: '12px',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '12px',
              color: '#f87171',
              marginBottom: '20px',
              fontSize: '0.85rem'
            }}>
              {stripeConnectError}
            </div>
          )}

          <button
            style={{
              ...btnStyle,
              opacity: stripeConnectLoading ? 0.7 : 1,
              cursor: stripeConnectLoading ? 'not-allowed' : 'pointer'
            }}
            onClick={startStripeConnect}
            disabled={stripeConnectLoading}
          >
            {stripeConnectLoading ? 'Setting up...' : 'Connect Bank Account'}
          </button>

          <button
            style={{
              ...btnSecondaryStyle,
              marginTop: '10px'
            }}
            onClick={() => setScreen('giveConfirmation')}
          >
            Skip for now
          </button>

          <p style={{ fontSize: '0.8rem', color: colors.textMuted, textAlign: 'center', marginTop: '20px' }}>
            You can set up payouts later from your profile. You won't be able to receive payments until connected.
          </p>
        </div>
      </div>
    )
  }

  if (screen === 'payoutSetupComplete') {
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
          <h1 style={{ fontSize: '2rem', marginBottom: '15px', fontWeight: 600 }}>Payouts Connected</h1>
          <p style={{ color: colors.textSecondary, marginBottom: '10px' }}>
            You're all set to receive payments!
          </p>
          <p style={{ color: colors.accent, fontSize: '1.1rem', fontWeight: 500, marginBottom: '30px' }}>
            You receive ${myGiverProfile?.rate_per_30} per 25-min session
          </p>
          <button style={{ ...btnStyle, maxWidth: '320px' }} onClick={() => setScreen('giveConfirmation')}>
            Continue
          </button>
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
          }}>🌱</div>
          <h1 style={{ fontSize: '2rem', marginBottom: '15px', fontWeight: 600 }}>You're Live</h1>
          <p style={{ color: colors.textSecondary, marginBottom: '15px' }}>
            Your profile is now visible to people seeking presence.
          </p>

          {myGiverProfile && !myGiverProfile.stripe_onboarding_complete && (
            <div style={{
              background: 'rgba(201, 166, 107, 0.1)',
              border: `1px solid ${colors.accent}`,
              borderRadius: '12px',
              padding: '15px',
              marginBottom: '20px',
              maxWidth: '320px'
            }}>
              <p style={{ color: colors.accent, fontSize: '0.9rem', marginBottom: '10px' }}>
                Payout setup incomplete
              </p>
              <button
                style={{
                  background: 'transparent',
                  border: `1px solid ${colors.accent}`,
                  color: colors.accent,
                  padding: '8px 16px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
                onClick={() => setScreen('payoutSetup')}
              >
                Set Up Payouts
              </button>
            </div>
          )}

          {myGiverProfile?.stripe_onboarding_complete && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: colors.success,
              marginBottom: '20px'
            }}>
              <span>✓</span>
              <span>Payouts connected</span>
            </div>
          )}

          <button style={{ ...btnStyle, maxWidth: '320px' }} onClick={() => setScreen('sessions')}>
            View My Bookings
          </button>
          <button
            style={{ ...btnSecondaryStyle, maxWidth: '320px', marginTop: '10px' }}
            onClick={() => setScreen('browse')}
          >
            Browse Other Hosts
          </button>
        </div>
      </div>
    )
  }

  // Video session screen with phased protocol
  if (screen === 'videoSession' && activeSession && user) {
    const userRole = user.id === activeSession.seeker_id ? 'receiver' : 'giver'

    return (
      <VideoSessionWrapper>
        <div style={{
          width: '100vw',
          height: '100dvh', // Use dynamic viewport height for mobile
          position: 'relative',
          overflow: 'hidden',
          background: colors.bgSecondary,
        }}>
          {/* Daily video container (background layer) */}
          <div
            ref={videoContainerRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: colors.bgSecondary,
              zIndex: 1,
            }}
          />

        {/* SessionStateMachine overlay - only show after user completes Daily prejoin */}
        {dailyMeetingJoined && (
          <SessionStateMachine
            booking={activeSession}
            dailyCall={dailyCallRef.current}
            userRole={userRole}
            userId={user.id}
            sessionTimeRemaining={_sessionTimeRemaining}
            onSessionEnd={() => leaveSession(false)}
            onRequestExtension={() => {
              console.log('Extension requested from SessionStateMachine')
            }}
          />
        )}

        {/* Receiver-Initiated Extension System - only show after prejoin */}
        {dailyMeetingJoined && (
          <ReceiverInitiatedExtension
            bookingId={activeSession.id}
            userRole={userRole}
            userId={user.id}
            giverId={activeSession.giver_id}
            receiverId={activeSession.seeker_id}
            receiverName={activeSession.seeker_id === user.id ? 'The guest' : 'The guest'} // TODO: Fetch guest name from profile
            amountCents={activeSession.amount_cents}
            sessionTimeRemaining={_sessionTimeRemaining}
            onExtensionGranted={() => {
              // Add 30 minutes (1800 seconds) to session time
              setSessionTimeRemaining(prev => prev + 1800)
              console.log('Extension granted: Added 30 minutes')
            }}
            onExtensionDeclined={() => {
              console.log('Extension declined')
            }}
          />
        )}

        {/* Leave session button - only show after Daily prejoin complete */}
        {dailyMeetingJoined && (
          <div style={{
            position: 'absolute',
            top: '80px', // Below phase indicator
            right: spacing.lg,
            zIndex: 10, // Lower z-index to not cover protocol UI
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.xs,
          }}>
            <button
              onClick={() => leaveSession(false)}
              style={{
                background: 'rgba(201, 107, 107, 0.9)',
                color: '#fff',
                border: 'none',
                padding: `${spacing.sm} ${spacing.lg}`,
                borderRadius: '3px',
                fontSize: typography.sm,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.xs,
              }}
            >
              <span style={{ fontSize: typography.md }}>📞</span>
              Leave
            </button>

            {/* Safety Exit - giver only, small and quiet */}
            {userRole === 'giver' && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to exit for safety reasons? This will end the session immediately.')) {
                    finalizeSession('safety_exit')
                  }
                }}
                style={{
                  background: 'transparent',
                  color: '#d9534f',
                  border: '1px solid rgba(217, 83, 79, 0.3)',
                  padding: `6px ${spacing.sm}`,
                  borderRadius: '3px',
                  fontSize: typography.xs,
                  fontWeight: 400,
                  cursor: 'pointer',
                  opacity: 0.7,
                }}
              >
                Safety Exit
              </button>
            )}
          </div>
        )}

        {/* Ending session overlay */}
        {isFinalizingSession && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              color: '#fff',
              fontSize: typography.lg,
              fontWeight: 500,
            }}>
              Ending session...
            </div>
          </div>
        )}
        </div>
      </VideoSessionWrapper>
    )
  }

  // Feedback screen (Phase 8)
  if (screen === 'feedback') {
    return (
      <div style={containerStyle}>
        <div style={screenStyle}>
          <h2 style={{ fontSize: typography.xl, fontWeight: 600, textAlign: 'center', marginBottom: spacing.md }}>
            Feedback
          </h2>

          <p style={{
            textAlign: 'center',
            color: colors.textSecondary,
            marginBottom: spacing.xxl,
            fontSize: typography.sm,
            lineHeight: 1.6,
          }}>
            Your feedback helps improve the MYCA experience.<br />
            Responses are binary signals only—no text reviews.
          </p>

          {/* Question 1: Would book again */}
          <div style={{ marginBottom: spacing.xxl }}>
            <h3 style={{
              fontSize: typography.lg,
              marginBottom: spacing.lg,
              color: colors.textPrimary,
            }}>
              Would you book this giver again?
            </h3>
            <div style={{ display: 'flex', gap: spacing.md }}>
              <button
                onClick={() => setWouldBookAgain(true)}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  background: wouldBookAgain === true ? colors.success : colors.bgSecondary,
                  color: wouldBookAgain === true ? '#fff' : colors.textPrimary,
                  border: wouldBookAgain === true ? `2px solid ${colors.success}` : `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  fontSize: typography.md,
                  fontWeight: wouldBookAgain === true ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setWouldBookAgain(false)}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  background: wouldBookAgain === false ? 'rgba(201, 107, 107, 0.9)' : colors.bgSecondary,
                  color: wouldBookAgain === false ? '#fff' : colors.textPrimary,
                  border: wouldBookAgain === false ? '2px solid rgba(201, 107, 107, 0.9)' : `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  fontSize: typography.md,
                  fontWeight: wouldBookAgain === false ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </div>

          {/* Question 2: Matched mode */}
          <div style={{ marginBottom: spacing.xxl }}>
            <h3 style={{
              fontSize: typography.lg,
              marginBottom: spacing.lg,
              color: colors.textPrimary,
            }}>
              Did the conversation match the advertised mode?
            </h3>
            <div style={{ display: 'flex', gap: spacing.md }}>
              <button
                onClick={() => setMatchedMode(true)}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  background: matchedMode === true ? colors.success : colors.bgSecondary,
                  color: matchedMode === true ? '#fff' : colors.textPrimary,
                  border: matchedMode === true ? `2px solid ${colors.success}` : `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  fontSize: typography.md,
                  fontWeight: matchedMode === true ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                Yes
              </button>
              <button
                onClick={() => setMatchedMode(false)}
                style={{
                  flex: 1,
                  padding: spacing.md,
                  background: matchedMode === false ? 'rgba(201, 107, 107, 0.9)' : colors.bgSecondary,
                  color: matchedMode === false ? '#fff' : colors.textPrimary,
                  border: matchedMode === false ? '2px solid rgba(201, 107, 107, 0.9)' : `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  fontSize: typography.md,
                  fontWeight: matchedMode === false ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            onClick={submitFeedback}
            disabled={feedbackSubmitting || wouldBookAgain === null || matchedMode === null}
            style={{
              ...btnStyle,
              opacity: wouldBookAgain === null || matchedMode === null ? 0.5 : 1,
              cursor: wouldBookAgain === null || matchedMode === null ? 'not-allowed' : 'pointer',
            }}
          >
            {feedbackSubmitting ? 'Submitting...' : 'Submit'}
          </button>

          {/* Skip button */}
          <button
            onClick={() => {
              setFeedbackBooking(null)
              setWouldBookAgain(null)
              setMatchedMode(null)
              setScreen('sessions')
            }}
            style={{
              ...btnStyle,
              background: 'transparent',
              color: colors.textSecondary,
              border: 'none',
              marginTop: spacing.sm,
            }}
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  if (screen === 'sessions') {
    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <SignOutButton />

          <h2 style={{ fontSize: typography.xl, fontWeight: 600, textAlign: 'center', marginBottom: spacing.sm }}>Sessions</h2>

          {/* Giver payout status card - Only show if is_giver true AND hasStripeAccountId false */}
          {(() => {
            if (!stripeState) return null
            if (stripeState.isGiver !== true) return null
            if (stripeState.hasStripeAccountId !== false) return null

            return (
              <div style={{
                ...cardStyle,
                cursor: 'default',
                marginBottom: '25px',
                background: `linear-gradient(135deg, rgba(201, 166, 107, 0.1), ${colors.bgCard})`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '5px' }}>Giver Payouts</h4>
                    <p style={{ fontSize: '0.85rem', color: colors.accent }}>Setup required</p>
                  </div>
                  <button
                    style={{
                      padding: '8px 16px',
                      background: colors.accent,
                      color: colors.bgPrimary,
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}
                    onClick={() => setScreen('payoutSetup')}
                  >
                    Set Up
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Bookings list */}
          {userBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: `${spacing.xxl} ${spacing.lg}`, color: colors.textMuted }}>
              {bookingsFetchError && (
                <div style={{
                  background: 'rgba(220,38,38,0.1)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  color: '#f87171',
                  padding: spacing.sm,
                  borderRadius: '3px',
                  marginBottom: spacing.lg,
                  fontSize: typography.sm,
                  textAlign: 'center'
                }}>
                  Unable to load sessions. Please try again.
                </div>
              )}
              <div style={{ fontSize: '3rem', marginBottom: spacing.lg }}>📅</div>
              <p style={{ marginBottom: spacing.sm, fontSize: typography.base }}>No bookings</p>
              <p style={{ fontSize: typography.sm, marginBottom: spacing.xxl }}>
                {myGiverProfile
                  ? 'When someone books you, it appears here'
                  : 'Book time to get started'}
              </p>
              <button
                style={{ ...btnStyle, maxWidth: '200px' }}
                onClick={() => setScreen('browse')}
              >
                {myGiverProfile ? 'Browse' : 'Find Someone'}
              </button>
            </div>
          ) : (
            <div>
              {/* As Seeker section */}
              {(() => {
                const seekerBookings = userBookings.filter(b => b.seeker_id === user?.id)
                return seekerBookings.length > 0 ? (
                  <div style={{ marginBottom: spacing.xxl }}>
                    <h3 style={{ fontSize: typography.base, color: colors.textSecondary, marginBottom: spacing.md, fontWeight: 500 }}>
                      As seeker ({seekerBookings.length})
                    </h3>
                    {seekerBookings.map(booking => {
                const scheduledDate = new Date(booking.scheduled_time)
                const isSeeker = booking.seeker_id === user?.id
                const joinable = isSessionJoinable(booking)
                const isPast = scheduledDate.getTime() + 30 * 60 * 1000 < Date.now()

                return (
                  <div
                    key={booking.id}
                    style={{
                      ...cardStyle,
                      cursor: 'default',
                      opacity: isPast ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
                      <div>
                        <div style={{
                          fontSize: typography.xs,
                          color: isSeeker ? colors.accent : colors.success,
                          marginBottom: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {isSeeker ? 'You booked' : 'You are giving'}
                        </div>
                        <div style={{ fontSize: typography.lg, fontWeight: 500 }}>
                          {BLOCK_MINUTES} minutes
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: typography.xs,
                        background: booking.status === 'confirmed'
                          ? colors.accentSoft
                          : booking.status === 'pending_approval'
                          ? 'rgba(251,191,36,0.15)'
                          : colors.bgSecondary,
                        color: booking.status === 'confirmed'
                          ? colors.accent
                          : booking.status === 'pending_approval'
                          ? '#f59e0b'
                          : colors.textMuted,
                      }}>
                        {booking.status === 'confirmed'
                          ? 'Confirmed'
                          : booking.status === 'pending_approval'
                          ? 'Requested'
                          : booking.status === 'pending'
                          ? 'Requested'
                          : booking.status === 'in_progress'
                          ? 'Live'
                          : booking.status === 'completed'
                          ? 'Completed'
                          : booking.status === 'cancelled'
                          ? 'Canceled'
                          : booking.status}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      background: colors.bgSecondary,
                      borderRadius: '3px',
                      marginBottom: spacing.md,
                    }}>
                      <div style={{ fontSize: typography.xl }}>📅</div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: typography.base }}>
                          {scheduledDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                          {scheduledDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                          {userProfile && ` (${getTimezoneAbbr(userProfile.timezone)})`}
                        </div>
                      </div>
                    </div>

                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => joinable && joinSession(booking)}
                        disabled={!joinable}
                        style={{
                          width: '100%',
                          padding: spacing.md,
                          borderRadius: '3px',
                          border: 'none',
                          fontSize: typography.md,
                          fontWeight: 500,
                          cursor: joinable ? 'pointer' : 'not-allowed',
                          background: joinable ? colors.success : colors.bgSecondary,
                          color: joinable ? '#fff' : colors.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        {joinable ? (
                          <>
                            <span>🎥</span>
                            Join
                          </>
                        ) : isPast ? (
                          'Ended'
                        ) : (
                          `Opens at ${scheduledDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}`
                        )}
                      </button>
                    )}

                    {booking.status === 'confirmed' && !isPast && (
                      <>
                        <p style={{ fontSize: typography.xs, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs }}>
                          {booking.giver_id === user?.id
                            ? 'Cancelling forfeits your payment.'
                            : 'Cancelling means host keeps payment.'}
                        </p>
                        <button
                          onClick={async () => {
                            const isGiver = booking.giver_id === user?.id

                            // Different consequences based on who cancels
                            const message = isGiver
                              ? 'Cancel this booking? The guest will receive a full refund. You will not be paid.'
                              : 'Cancel this booking? Your payment will still go to the host. No refund.'

                            if (confirm(message)) {
                              const { error } = await supabase
                                .from('bookings')
                                .update({
                                  status: 'cancelled',
                                  cancelled_by: isGiver ? 'giver' : 'seeker',
                                  cancelled_at: new Date().toISOString(),
                                  refund_to_seeker: isGiver ? true : false
                                })
                                .eq('id', booking.id)

                              if (!error) {
                                // Send cancellation notification
                                await sendNotification('cancellation', booking.id)
                                await fetchUserBookings()

                                if (isGiver) {
                                  alert('Booking cancelled. The guest will be refunded.')
                                } else {
                                  alert('Booking cancelled. Your payment has been forfeited to the host.')
                                }
                              } else {
                                console.error('Cancellation error:', error)
                                alert('Failed to cancel booking. Please try again.')
                              }
                            }
                          }}
                        style={{
                          width: '100%',
                          padding: spacing.sm,
                          borderRadius: '3px',
                          border: `1px solid rgba(220,38,38,0.3)`,
                          background: 'rgba(220,38,38,0.1)',
                          color: '#f87171',
                          cursor: 'pointer',
                          marginTop: spacing.sm,
                          fontSize: typography.sm,
                        }}
                      >
                        Cancel
                      </button>
                      </>
                    )}

                    {/* Feedback status for completed sessions (Phase 8) */}
                    {booking.status === 'completed' && isSeeker && (
                      <div style={{
                        marginTop: spacing.md,
                        padding: spacing.sm,
                        background: colors.bgSecondary,
                        borderRadius: '3px',
                        fontSize: typography.sm,
                        color: colors.textSecondary,
                      }}>
                        <div style={{ marginBottom: spacing.xs, fontWeight: 500, color: colors.textPrimary }}>
                          Feedback
                        </div>
                        <button
                          onClick={() => {
                            setFeedbackBooking(booking)
                            setWouldBookAgain(null)
                            setMatchedMode(null)
                            setScreen('feedback')
                          }}
                          style={{
                            width: '100%',
                            padding: spacing.sm,
                            background: colors.accent,
                            color: colors.bgPrimary,
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: typography.sm,
                            fontWeight: 500,
                          }}
                        >
                          Leave Feedback
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
                  </div>
                ) : null
              })()}

              {/* As Giver section */}
              {(() => {
                const giverBookings = userBookings
                  .filter(b => b.giver_id === user?.id)
                  .sort((a, b) => {
                    // Sort pending_approval first
                    if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1
                    if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1
                    // Then by scheduled time
                    return new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
                  })
                return giverBookings.length > 0 ? (
                  <div>
                    <h3 style={{ fontSize: typography.base, fontWeight: 500, color: colors.textSecondary, marginBottom: spacing.md }}>
                      As giver ({giverBookings.length})
                    </h3>
                    {giverBookings.map(booking => {
                const scheduledDate = new Date(booking.scheduled_time)
                const isSeeker = booking.seeker_id === user?.id
                const joinable = isSessionJoinable(booking)
                const isPast = scheduledDate.getTime() + 30 * 60 * 1000 < Date.now()

                return (
                  <div
                    key={booking.id}
                    onClick={() => {
                      // Make card clickable - could navigate to booking details
                      console.log('Clicked giver booking:', booking.id)
                    }}
                    style={{
                      ...cardStyle,
                      cursor: 'pointer',
                      opacity: isPast ? 0.6 : 1,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md }}>
                      <div>
                        <div style={{
                          fontSize: typography.xs,
                          color: isSeeker ? colors.accent : colors.success,
                          marginBottom: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {isSeeker ? 'You booked' : 'You are giving'}
                        </div>
                        <div style={{ fontSize: typography.lg, fontWeight: 500 }}>
                          {BLOCK_MINUTES} minutes
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '3px',
                        fontSize: typography.xs,
                        background: booking.status === 'confirmed'
                          ? colors.accentSoft
                          : booking.status === 'pending_approval'
                          ? 'rgba(251,191,36,0.15)'
                          : colors.bgSecondary,
                        color: booking.status === 'confirmed'
                          ? colors.accent
                          : booking.status === 'pending_approval'
                          ? '#f59e0b'
                          : colors.textMuted,
                      }}>
                        {booking.status === 'confirmed'
                          ? 'Confirmed'
                          : booking.status === 'pending_approval'
                          ? 'Requested'
                          : booking.status === 'pending'
                          ? 'Requested'
                          : booking.status === 'in_progress'
                          ? 'Live'
                          : booking.status === 'completed'
                          ? 'Completed'
                          : booking.status === 'cancelled'
                          ? 'Canceled'
                          : booking.status}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      background: colors.bgSecondary,
                      borderRadius: '3px',
                      marginBottom: spacing.md,
                    }}>
                      <div style={{ fontSize: typography.xl }}>📅</div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: typography.base }}>
                          {scheduledDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                          {scheduledDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                          {userProfile && ` (${getTimezoneAbbr(userProfile.timezone)})`}
                        </div>
                      </div>
                    </div>

                    {booking.status === 'confirmed' && (
                      <button
                        onClick={() => joinable && joinSession(booking)}
                        disabled={!joinable}
                        style={{
                          width: '100%',
                          padding: spacing.md,
                          borderRadius: '3px',
                          border: 'none',
                          fontSize: typography.md,
                          fontWeight: 500,
                          cursor: joinable ? 'pointer' : 'not-allowed',
                          background: joinable ? colors.success : colors.bgSecondary,
                          color: joinable ? '#fff' : colors.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: spacing.sm,
                        }}
                      >
                        {joinable ? (
                          <>
                            <span>🎥</span>
                            Join
                          </>
                        ) : isPast ? (
                          'Ended'
                        ) : (
                          `Opens at ${scheduledDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}`
                        )}
                      </button>
                    )}

                    {booking.status === 'pending_approval' && (
                      <>
                        {isPast && (
                          <div style={{
                            padding: spacing.xs,
                            background: 'rgba(251,191,36,0.1)',
                            border: '1px solid rgba(251,191,36,0.3)',
                            borderRadius: '3px',
                            fontSize: typography.xs,
                            color: '#f59e0b',
                            marginTop: spacing.sm,
                            marginBottom: spacing.xs,
                          }}>
                            This time has passed - approve to reschedule or decline to refund
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: spacing.sm, marginTop: spacing.sm }}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (confirm('Approve this booking?')) {
                                const { error } = await supabase
                                  .from('bookings')
                                  .update({
                                    status: 'confirmed',
                                  })
                                  .eq('id', booking.id)

                                if (!error) {
                                  // Send confirmation emails
                                  try {
                                    await supabase.functions.invoke('send-booking-emails', {
                                      body: {
                                        booking_id: booking.id,
                                        event: 'confirmed',
                                      },
                                    })
                                  } catch (emailError) {
                                    console.error('Failed to send confirmation emails:', emailError)
                                  }
                                  await fetchUserBookings()
                                  alert('Booking approved!')
                                } else {
                                  console.error('Approval error:', error)
                                  alert('Failed to approve booking. Please try again.')
                                }
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: spacing.sm,
                              borderRadius: '3px',
                              border: `1px solid rgba(34,197,94,0.3)`,
                              background: 'rgba(34,197,94,0.1)',
                              color: '#22c55e',
                              cursor: 'pointer',
                              fontSize: typography.sm,
                              fontWeight: 500,
                            }}
                          >
                            Approve
                          </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (confirm('Decline this booking? The guest will be refunded.')) {
                              const { error } = await supabase
                                .from('bookings')
                                .update({
                                  status: 'cancelled',
                                  cancelled_by: 'giver',
                                  cancelled_at: new Date().toISOString(),
                                  refund_to_seeker: true
                                })
                                .eq('id', booking.id)

                              if (!error) {
                                // Send cancellation emails
                                try {
                                  await supabase.functions.invoke('send-booking-emails', {
                                    body: {
                                      booking_id: booking.id,
                                      event: 'cancelled',
                                    },
                                  })
                                } catch (emailError) {
                                  console.error('Failed to send cancellation emails:', emailError)
                                }
                                await fetchUserBookings()
                                alert('Booking declined. The guest will be refunded.')
                              } else {
                                console.error('Decline error:', error)
                                alert('Failed to decline booking. Please try again.')
                              }
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: spacing.sm,
                            borderRadius: '3px',
                            border: `1px solid rgba(220,38,38,0.3)`,
                            background: 'rgba(220,38,38,0.1)',
                            color: '#f87171',
                            cursor: 'pointer',
                            fontSize: typography.sm,
                            fontWeight: 500,
                          }}
                        >
                          Decline
                        </button>
                      </div>
                      </>
                    )}

                    {booking.status === 'pending' && !isPast && (
                      <>
                      <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            const isGiver = user && user.id === booking.giver_id
                            const message = isGiver
                              ? 'Cancel this booking? The guest will receive a full refund. You will not be paid.'
                              : 'Cancel this booking? Your payment will still go to the host. No refund.'

                            if (confirm(message)) {
                              const { error } = await supabase
                                .from('bookings')
                                .update({
                                  status: 'cancelled',
                                  cancelled_by: isGiver ? 'giver' : 'seeker',
                                  cancelled_at: new Date().toISOString(),
                                  refund_to_seeker: isGiver ? true : false
                                })
                                .eq('id', booking.id)

                              if (!error) {
                                await sendNotification('cancellation', booking.id)
                                await fetchUserBookings()

                                if (isGiver) {
                                  alert('Booking cancelled. The guest will be refunded.')
                                } else {
                                  alert('Booking cancelled. Your payment has been forfeited to the host.')
                                }
                              } else {
                                console.error('Cancellation error:', error)
                                alert('Failed to cancel booking. Please try again.')
                              }
                            }
                          }}
                        style={{
                          width: '100%',
                          padding: spacing.sm,
                          borderRadius: '3px',
                          border: `1px solid rgba(220,38,38,0.3)`,
                          background: 'rgba(220,38,38,0.1)',
                          color: '#f87171',
                          cursor: 'pointer',
                          marginTop: spacing.sm,
                          fontSize: typography.sm,
                        }}
                      >
                        Cancel
                      </button>
                      </>
                    )}
                  </div>
                )
              })}
                  </div>
                ) : null
              })()}

              <button
                style={{ ...btnSecondaryStyle, marginTop: '20px' }}
                onClick={() => setScreen('browse')}
              >
                Book More Time
              </button>
            </div>
          )}
          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'userProfile') {
    if (!user) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>Please sign in to view your profile</p>
              <button style={btnStyle} onClick={() => setScreen('welcome')}>Go to Home</button>
            </div>
          </div>
        </div>
      )
    }

    const currentTimezone = userProfile?.timezone || myGiverProfile?.timezone || 'America/New_York'

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
          <SignOutButton />

          <h2 style={{ fontSize: typography.xl, fontWeight: 600, textAlign: 'center', marginBottom: spacing.xxl }}>
            {myGiverProfile ? 'Account and Profile' : 'Settings'}
          </h2>

          {/* Account Info */}
          <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
            <h3 style={{ fontSize: typography.lg, marginBottom: spacing.md, fontWeight: 600 }}>Account</h3>
            <div style={{ marginBottom: spacing.sm }}>
              <p style={{ color: colors.textSecondary, fontSize: typography.sm, marginBottom: '6px' }}>Email</p>
              <p style={{ color: colors.textPrimary, fontSize: typography.md }}>{user.email}</p>
            </div>
          </div>

          {/* Profile photo */}
          <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
            <h3 style={{ fontSize: typography.lg, marginBottom: spacing.md, fontWeight: 600 }}>Profile photo</h3>
            <ImageUpload
              onUpload={async (publicUrl) => {
                // Update profile with new picture URL
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({ profile_picture_url: publicUrl })
                  .eq('id', user.id)

                if (updateError) throw updateError

                // Refresh profile
                await fetchMyGiverProfile()
              }}
              currentImageUrl={myGiverProfile?.profile_picture_url || undefined}
              bucketName="profile-pictures"
              maxSizeMB={5}
              aspectRatio="circle"
              initials={(myGiverProfile?.name?.[0] || user.email?.[0] || '?').toUpperCase()}
            />
          </div>

          {/* Timezone Setting */}
          <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
            <h3 style={{ fontSize: typography.lg, marginBottom: spacing.md, fontWeight: 600 }}>Timezone</h3>
            <select
              value={currentTimezone}
              onChange={async (e) => {
                const newTimezone = e.target.value
                try {
                  // Update profiles table with timezone
                  const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                      id: user.id,
                      timezone: newTimezone,
                      updated_at: new Date().toISOString()
                    }, { onConflict: 'id' })

                  if (profileError) throw profileError

                  // Refresh data
                  await fetchUserProfile()
                  if (myGiverProfile) await fetchMyGiverProfile()

                  alert('Timezone updated')
                } catch (err) {
                  console.error('Error updating timezone:', err)
                  alert('Failed to update timezone')
                }
              }}
              style={{
                width: '100%',
                padding: spacing.md,
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '3px',
                color: colors.textPrimary,
                fontSize: typography.md,
                boxSizing: 'border-box'
              }}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p style={{ color: colors.textMuted, fontSize: typography.sm, marginTop: spacing.xs }}>
              Times displayed in your timezone
            </p>
          </div>

          {/* Giver Profile Section - Full Editor */}
          {myGiverProfile ? (
            <>
              {/* Name & Tagline */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
                <h3 style={{ fontSize: typography.lg, marginBottom: spacing.md, fontWeight: 600 }}>Public Profile</h3>

                <div style={{ marginBottom: spacing.md }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>Name</label>
                  <input
                    value={giverName}
                    onChange={(e) => setGiverName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: spacing.sm,
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '3px',
                      color: colors.textPrimary,
                      fontSize: typography.md,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: spacing.md }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>How do you hold the room?</label>
                  <input
                    value={giverTagline}
                    onChange={(e) => setGiverTagline(e.target.value)}
                    placeholder="Optional"
                    style={{
                      width: '100%',
                      padding: spacing.sm,
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '3px',
                      color: colors.textPrimary,
                      fontSize: typography.md,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: spacing.md }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
                    Bio <span style={{ color: colors.textMuted }}>(500 char max)</span>
                  </label>
                  <textarea
                    value={giverBio}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setGiverBio(e.target.value)
                      }
                    }}
                    placeholder="Describe what kind of clarity, challenge, steadiness, or perspective you tend to bring."
                    style={{
                      width: '100%',
                      padding: spacing.sm,
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '3px',
                      color: colors.textPrimary,
                      fontSize: typography.md,
                      boxSizing: 'border-box',
                      minHeight: '90px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                  <p style={{ color: colors.textMuted, fontSize: typography.xs, marginTop: '6px', textAlign: 'right' }}>
                    {giverBio.length}/500
                  </p>
                </div>

                <button
                  onClick={async () => {
                    if (!giverName.trim()) {
                      alert('Name is required')
                      return
                    }
                    try {
                      const { error } = await supabase
                        .from('profiles')
                        .update({
                          name: giverName.trim(),
                          tagline: giverTagline.trim() || null,
                          bio: giverBio.trim() || null,
                          qualities_offered: giverQualities,
                        })
                        .eq('id', user.id)

                      if (error) throw error

                      await fetchMyGiverProfile()
                      await fetchGivers()
                      alert('Profile updated')
                    } catch (err) {
                      console.error('Error updating profile:', err)
                      alert('Failed to update profile')
                    }
                  }}
                  style={{
                    ...btnStyle,
                    margin: 0,
                    width: '100%'
                  }}
                >
                  Save
                </button>
              </div>

              {/* Rate */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
                <h3 style={{ fontSize: typography.lg, marginBottom: spacing.md, fontWeight: 600 }}>Your current rate</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <span style={{ color: colors.textPrimary, fontSize: typography.lg }}>$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={giverRate}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '')
                      setGiverRate(val === '' ? 0 : parseInt(val))
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value)
                      if (!val || val < 15) {
                        setGiverRate(15)
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: spacing.sm,
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '3px',
                      color: colors.textPrimary,
                      fontSize: typography.md,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ color: colors.textSecondary, fontSize: typography.base }}>per 25-min session</span>
                </div>
                <p style={{ color: colors.textMuted, fontSize: typography.sm, marginBottom: spacing.md }}>Minimum $15</p>
                <button
                  onClick={async () => {
                    if (giverRate < 15) {
                      alert('Minimum rate is $15')
                      return
                    }
                    try {
                      const { error } = await supabase
                        .from('profiles')
                        .update({ rate_per_30: giverRate })
                        .eq('id', user.id)

                      if (error) throw error

                      await fetchMyGiverProfile()
                      await fetchGivers()
                      alert('Rate updated')
                    } catch (err) {
                      console.error('Error updating rate:', err)
                      alert('Failed to update rate')
                    }
                  }}
                  style={{
                    ...btnStyle,
                    margin: 0,
                    width: '100%'
                  }}
                >
                  Save Rate
                </button>
              </div>

              {/* Introduction Video */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
                <h3 style={{ fontSize: typography.lg, marginBottom: spacing.md, fontWeight: 600 }}>Introduction Video</h3>
                {myGiverProfile?.video_url ? (
                  <>
                    <div style={{ borderRadius: '3px', overflow: 'hidden', marginBottom: spacing.md }}>
                      <video src={myGiverProfile.video_url} controls playsInline style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                    </div>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                      <button
                        style={{ ...btnSecondaryStyle, flex: 1, margin: 0 }}
                        onClick={() => setScreen('editVideo')}
                      >
                        Replace
                      </button>
                      <button
                        style={{
                          flex: 1,
                          padding: spacing.md,
                          background: 'rgba(220, 38, 38, 0.1)',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                          borderRadius: '3px',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: typography.base,
                          fontWeight: 500
                        }}
                        onClick={async () => {
                          if (confirm('Delete your introduction video?')) {
                            const { error } = await supabase
                              .from('profiles')
                              .update({ video_url: null })
                              .eq('id', user.id)

                            if (!error) {
                              setMyGiverProfile({ ...myGiverProfile, video_url: null })
                            }
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ color: colors.textSecondary, fontSize: typography.base, marginBottom: spacing.md }}>
                      Record introduction video (15-30 seconds)
                    </p>
                    <button
                      style={{ ...btnStyle, margin: 0, width: '100%' }}
                      onClick={() => setScreen('editVideo')}
                    >
                      Record video
                    </button>
                  </>
                )}
              </div>

              {/* Manage Availability */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
                <h3 style={{ fontSize: typography.lg, marginBottom: spacing.xs, fontWeight: 600 }}>Availability</h3>
                <p style={{ color: colors.textSecondary, fontSize: typography.base, marginBottom: spacing.md }}>
                  Set times when you're available for bookings
                </p>
                <button
                  style={{ ...btnStyle, margin: 0, width: '100%' }}
                  onClick={() => setScreen('give')}
                >
                  Availability
                </button>
              </div>

              {/* What You Offer */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
                <h3 style={{ fontSize: typography.lg, marginBottom: spacing.xs, fontWeight: 600 }}>Your rooms</h3>
                <p style={{ color: colors.textSecondary, fontSize: typography.base, marginBottom: spacing.xs }}>
                  Different types of conversations at different prices
                </p>
                <p style={{ color: colors.textMuted, fontSize: typography.sm, marginBottom: spacing.md }}>
                  {myListings.length} {myListings.length === 1 ? 'offer' : 'offers'}
                </p>
                <div style={{ display: 'flex', gap: spacing.sm }}>
                  <button
                    style={{ ...btnStyle, flex: 1, margin: 0 }}
                    onClick={() => setScreen('createListing')}
                  >
                    Define your session style
                  </button>
                  <button
                    style={{ ...btnSecondaryStyle, flex: 1, margin: 0 }}
                    onClick={() => setScreen('manageListings')}
                  >
                    Manage
                  </button>
                </div>
              </div>

              {/* Share Profile */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
                <h3 style={{ fontSize: typography.lg, marginBottom: spacing.xs, fontWeight: 600 }}>Share Profile</h3>
                <p style={{ color: colors.textSecondary, fontSize: typography.base, marginBottom: spacing.md }}>
                  Direct link to your profile
                </p>
                <button
                  style={{ ...btnStyle, margin: 0, width: '100%' }}
                  onClick={() => {
                    const shareUrl = `${window.location.origin}?giver=${user.id}`
                    navigator.clipboard.writeText(shareUrl)
                    alert('Link copied')
                  }}
                >
                  Copy Link
                </button>
              </div>

              {/* Upcoming Availability */}
              {myGiverProfile && availabilitySlots.length > 0 && (
                <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
                  <h3 style={{ fontSize: typography.lg, marginBottom: spacing.md, fontWeight: 600 }}>
                    Upcoming Availability ({availabilitySlots.length} slots)
                  </h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {Object.entries(
                      availabilitySlots
                        .filter(s => s.date >= new Date().toISOString().split('T')[0])
                        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
                        .reduce((acc, slot) => {
                          if (!acc[slot.date]) acc[slot.date] = []
                          acc[slot.date].push(slot)
                          return acc
                        }, {} as Record<string, typeof availabilitySlots>)
                    ).map(([date, slots]) => (
                      <div key={date} style={{ marginBottom: spacing.md }}>
                        <div style={{
                          fontSize: typography.base,
                          fontWeight: 600,
                          color: colors.accent,
                          marginBottom: spacing.xs
                        }}>
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {slots.map(slot => (
                            <span
                              key={slot.id}
                              style={{
                                padding: '6px 10px',
                                background: colors.bgSecondary,
                                borderRadius: '3px',
                                fontSize: typography.sm,
                                color: colors.textPrimary
                              }}
                            >
                              {formatTimeTo12Hour(slot.time)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Non-giver: Option to become a giver */
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
              <h3 style={{ fontSize: typography.lg, marginBottom: spacing.xs, fontWeight: 600 }}>Become a Giver</h3>
              <p style={{ color: colors.textSecondary, fontSize: typography.base, marginBottom: spacing.md }}>
                Get paid for your time
              </p>
              <button
                style={{ ...btnStyle, margin: 0, width: '100%' }}
                onClick={() => setScreen('giverIntro')}
              >
                Offer Your Time
              </button>
            </div>
          )}

          <Nav />
        </div>
      </div>
    )
  }

  // === LISTING MANAGEMENT SCREENS (Multi-Listing Architecture) ===

  if (screen === 'manageListings') {
    if (!user) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>Please sign in to manage listings</p>
              <button style={btnStyle} onClick={() => setScreen('welcome')}>Go to Home</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
          <SignOutButton />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
            <button onClick={() => setScreen('userProfile')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: typography.xl, fontWeight: 600 }}>Your rooms</h2>
            <div style={{ width: '40px' }} />
          </div>

          {listingsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: colors.textSecondary }}>Loading...</p>
            </div>
          ) : (
            <>
              {/* Create New Offer Button */}
              <button
                style={{
                  ...btnStyle,
                  marginBottom: spacing.sm,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs
                }}
                onClick={() => {
                  // Reset form
                  setListingFormData({
                    topic: '',
                    mode: 'mirror',
                    price_cents: 2500,
                    description: '',
                    selectedCategories: [],
                    requires_approval: true,
                    allow_instant_book: false,
                    directions_allowed: ['go_deeper', 'hear_perspective', 'think_together', 'build_next_step'],
                    boundaries: ''
                  })
                  setSelectedListing(null)
                  setScreen('createListing')
                }}
              >
                <span style={{ fontSize: typography.lg }}>+</span>
                Define your session style
              </button>

              {/* Manage Availability Button */}
              <button
                style={{
                  padding: `${spacing.md} ${spacing.xl}`,
                  borderRadius: '3px',
                  fontSize: typography.base,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${colors.border}`,
                  width: '100%',
                  background: colors.bgSecondary,
                  color: colors.textPrimary,
                  marginBottom: spacing.lg,
                  letterSpacing: '0.01em',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs
                }}
                onClick={() => setScreen('manageAvailability')}
              >
                Availability
              </button>

              {/* Offers List */}
              {myListings.length === 0 ? (
                <div style={{ ...cardStyle, cursor: 'default', textAlign: 'center' }}>
                  <p style={{ color: colors.textSecondary, marginBottom: spacing.md }}>
                    No offers yet
                  </p>
                  <p style={{ color: colors.textMuted, fontSize: typography.base }}>
                    Create an offer to start
                  </p>
                </div>
              ) : (
                <>
                  {myListings.map(listing => {
                    return (
                      <div
                        key={listing.id}
                        style={{
                          ...cardStyle,
                          borderLeft: `3px solid ${colors.accent}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: spacing.sm }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: typography.lg, marginBottom: '6px', fontWeight: 600 }}>
                              {listing.topic || 'Offer'}
                            </h3>
                            {/* Show mode badge */}
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              background: colors.accentSoft,
                              borderRadius: '3px',
                              fontSize: typography.xs,
                              color: colors.accent,
                              fontWeight: 500
                            }}>
                              {listing.mode?.replace('_', ' ') || 'General'}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: typography.lg, fontWeight: 600, color: colors.textPrimary }}>
                              ${(listing.price_cents / 100).toFixed(0)}
                            </div>
                            <div style={{ fontSize: typography.xs, color: colors.textMuted }}>
                              per 25-min session
                            </div>
                          </div>
                        </div>

                        {listing.description && (
                          <p style={{ fontSize: typography.base, color: colors.textSecondary, marginBottom: spacing.sm, lineHeight: '1.5' }}>
                            {listing.description}
                          </p>
                        )}

                        <div style={{ display: 'flex', gap: spacing.xs, marginTop: spacing.md }}>
                          <button
                            style={{
                              flex: 1,
                              padding: spacing.sm,
                              background: colors.bgSecondary,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '3px',
                              color: colors.textPrimary,
                              cursor: 'pointer',
                              fontSize: typography.base
                            }}
                            onClick={() => {
                              setSelectedListing(listing)
                              setListingFormData({
                                topic: listing.topic,
                                mode: listing.mode,
                                price_cents: listing.price_cents,
                                description: listing.description || '',
                                selectedCategories: listing.categories || [],
                                requires_approval: listing.requires_approval !== undefined ? listing.requires_approval : true,
                                allow_instant_book: listing.allow_instant_book || false,
                                directions_allowed: listing.directions_allowed || ['go_deeper', 'hear_perspective', 'think_together', 'build_next_step', 'end_cleanly'],
                                boundaries: listing.boundaries || ''
                              })
                              setScreen('editListing')
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}

          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'createListing') {
    if (!user) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>Please sign in to create an offer</p>
              <button style={btnStyle} onClick={() => setScreen('welcome')}>Go to Home</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
          <SignOutButton />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl }}>
            <button onClick={() => setScreen('manageListings')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: typography.xl, fontWeight: 600 }}>Define your session style</h2>
            <div style={{ width: '40px' }} />
          </div>

          <p style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            This is how people will understand what kind of space you can hold.
          </p>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setListingFormError(null)

              // Validation
              if (!listingFormData.topic.trim()) {
                setListingFormError('Please add a one-line description of how you hold the room.')
                return
              }

              const result = await createListing({
                topic: listingFormData.topic.trim(),
                mode: 'vault' as Mode,
                price_cents: 2500, // Trial rate fixed at $25
                description: listingFormData.description.trim(),
                categories: [],
                requires_approval: listingFormData.requires_approval,
                allow_instant_book: listingFormData.allow_instant_book,
                directions_allowed: listingFormData.directions_allowed,
                boundaries: listingFormData.boundaries
              })

              if (result.success) {
                setListingFormError(null)
                setScreen('manageListings')
              } else {
                // Show the full error details to user
                const errorMsg = result.error || 'Failed to create offer'
                console.error('Create offer error - FULL DETAILS:', errorMsg)
                setListingFormError(errorMsg)
              }
            }}
          >
            {/* Simplified: Giver offers themselves inside protocol, not expertise */}

            {/* Profile Photo */}
            <div style={{ marginBottom: spacing.lg }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
                Profile photo <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
              </label>
              <ImageUpload
                onUpload={async (publicUrl) => {
                  // Update profile with photo URL
                  await supabase
                    .from('profiles')
                    .update({ profile_picture_url: publicUrl })
                    .eq('id', user!.id)
                }}
                currentImageUrl={user?.user_metadata?.picture || undefined}
                bucketName="profile-pictures"
                maxSizeMB={5}
                aspectRatio="circle"
                initials={user?.email?.[0]?.toUpperCase() || '?'}
              />
            </div>

            {/* How do you hold the room? */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
                How do you hold the room? <span style={{ color: colors.accent }}>*</span>
              </label>
              <input
                type="text"
                value={listingFormData.topic}
                onChange={(e) => setListingFormData({ ...listingFormData, topic: e.target.value })}
                placeholder="One line. What kind of space do you create?"
                maxLength={120}
                required
                style={{
                  width: '100%',
                  padding: spacing.sm,
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: typography.base,
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Who gets the most value from this room? */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
                Who gets the most value from this room? <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={listingFormData.description}
                onChange={(e) => setListingFormData({ ...listingFormData, description: e.target.value })}
                placeholder="Describe the kind of person or situation where you are most useful."
                maxLength={300}
                style={{
                  width: '100%',
                  minHeight: '90px',
                  padding: spacing.sm,
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: typography.base,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Trial Pricing Block */}
            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.borderEmphasis}`,
              borderRadius: '3px',
              padding: spacing.lg,
              marginBottom: spacing.lg
            }}>
              <div style={{ fontSize: typography.base, fontWeight: 600, color: colors.textPrimary, marginBottom: spacing.xs }}>
                Trial
              </div>
              <div style={{ fontSize: typography.xl, fontWeight: 600, color: colors.accent, marginBottom: spacing.sm }}>
                $25 per 25-min session
              </div>
              <p style={{ fontSize: typography.sm, color: colors.textSecondary, lineHeight: 1.6, margin: 0 }}>
                Your rate stays fixed during Trial. Graduate by completing 5 clean sessions over at least 14 days, with strong receiver confirmation and no reliability issues.
              </p>
            </div>

            {/* Price */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg, display: 'none' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
                Price <span style={{ color: colors.accent }}>*</span>
              </label>
              <p style={{ color: colors.textMuted, fontSize: typography.sm, marginTop: '-4px', marginBottom: spacing.xs }}>
                per 25-min session ({BLOCK_MINUTES} minutes)
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                <span style={{ fontSize: typography.lg, color: colors.textPrimary }}>$</span>
                <input
                  type="number"
                  min="15"
                  step="1"
                  value={listingFormData.price_cents / 100}
                  onChange={(e) => {
                    const dollars = parseFloat(e.target.value) || 15
                    setListingFormData({ ...listingFormData, price_cents: Math.round(dollars * 100) })
                  }}
                  style={{
                    flex: 1,
                    padding: spacing.sm,
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '3px',
                    color: colors.textPrimary,
                    fontSize: typography.md,
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
            </div>

            {/* Direction Types Selection */}
            <div id="listing-directions-section" style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
                What kind of room can you hold? <span style={{ color: colors.accent }}>*</span>
              </label>
              <p style={{ color: colors.textSecondary, fontSize: typography.sm, marginBottom: spacing.md, lineHeight: 1.5 }}>
                Which directions they can choose during conversation
              </p>
              {[
                { value: 'go_deeper', label: 'Keep going', description: 'Continue exploring together', required: true },
                { value: 'hear_perspective', label: 'Listening and reflection', description: 'Share your thoughts and insights', required: false },
                { value: 'think_together', label: 'Thinking together', description: 'Collaborative dialogue with turn-taking', required: false },
                { value: 'build_next_step', label: 'Clarifying the next move', description: 'Help plan concrete actions', required: false },
                { value: 'pressure_test', label: 'Direct challenge', description: 'Challenge their thinking directly', required: false }
              ].map(direction => (
                <label
                  key={direction.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: spacing.sm,
                    marginBottom: spacing.xs,
                    background: listingFormData.directions_allowed?.includes(direction.value) ? colors.accentSoft : 'transparent',
                    border: `1px solid ${listingFormData.directions_allowed?.includes(direction.value) ? colors.accent : colors.border}`,
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={listingFormData.directions_allowed?.includes(direction.value) || false}
                    onChange={(e) => {
                      const current = listingFormData.directions_allowed || []
                      const updated = e.target.checked
                        ? [...current, direction.value]
                        : current.filter(d => d !== direction.value)
                      setListingFormData({ ...listingFormData, directions_allowed: updated })
                    }}
                    style={{ marginRight: spacing.sm, marginTop: '4px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 500, color: colors.textPrimary, marginBottom: '2px', fontSize: typography.base }}>
                      {direction.label}
                    </div>
                    <div style={{ fontSize: typography.sm, color: colors.textSecondary }}>
                      {direction.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Hard No's */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
                Boundaries <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
              </label>
              <p style={{ color: colors.textSecondary, fontSize: typography.sm, marginBottom: spacing.xs, lineHeight: 1.5 }}>
                Topics that will end the conversation
              </p>
              <textarea
                value={listingFormData.boundaries || ''}
                onChange={(e) => setListingFormData({ ...listingFormData, boundaries: e.target.value })}
                placeholder="e.g., No political debate, no medical advice"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: spacing.sm,
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: typography.base,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Instant Booking Toggle */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: spacing.lg }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={listingFormData.allow_instant_book || false}
                  onChange={(e) => setListingFormData({ ...listingFormData, allow_instant_book: e.target.checked })}
                  style={{ marginRight: spacing.sm, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ color: colors.textPrimary, fontSize: typography.base, fontWeight: 500 }}>
                    Instant booking
                  </div>
                  <div style={{ color: colors.textMuted, fontSize: typography.sm, marginTop: '4px' }}>
                    Bookings confirmed immediately without approval
                  </div>
                </div>
              </label>
            </div>

            {/* Error Display */}
            {listingFormError && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.1)',
                border: `1px solid rgba(220, 38, 38, 0.3)`,
                borderRadius: '3px',
                padding: spacing.md,
                marginBottom: spacing.lg
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
                  <span style={{ fontSize: typography.lg }}>⚠️</span>
                  <div>
                    <p style={{ color: '#fca5a5', fontWeight: 600, marginBottom: '5px', fontSize: typography.base }}>
                      Cannot create offer
                    </p>
                    <p style={{ color: colors.textSecondary, fontSize: typography.sm, lineHeight: 1.5 }}>
                      {listingFormError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button type="submit" style={btnStyle}>
              Create this room
            </button>
          </form>

          <Nav />
        </div>
      </div>
    )
  }

  if (screen === 'editListing') {
    if (!user || !selectedListing) {
      return (
        <div style={containerStyle}>
          <div style={screenStyle}>
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>Offer not found</p>
              <button style={btnStyle} onClick={() => setScreen('manageListings')}>Back to Offers</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
          <SignOutButton />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button onClick={() => setScreen('manageListings')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Edit your session style</h2>
            <div style={{ width: '40px' }} />
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              setListingFormError(null)

              // Validation
              if (listingFormData.price_cents < 1500) {
                setListingFormError('Minimum price is $15 per 25-min session')
                return
              }

              const result = await updateListing(selectedListing.id, {
                topic: listingFormData.topic.trim(),
                price_cents: listingFormData.price_cents,
                description: listingFormData.description.trim(),
                categories: listingFormData.selectedCategories
              })

              if (result.success) {
                setListingFormError(null)
                setScreen('manageListings')
              } else {
                // Show the full error details to user
                const errorMsg = result.error || 'Failed to update offer'
                console.error('Update offer error - FULL DETAILS:', errorMsg)
                setListingFormError(errorMsg)
              }
            }}
          >
            {/* STEP 2 - What category? */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '12px', fontSize: '0.9rem' }}>
                What category? <span style={{ color: colors.textMuted, fontWeight: 400 }}>(Select 1-3)</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {CATEGORIES.map(cat => {
                  const isSelected = listingFormData.selectedCategories.includes(cat.value)
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setListingFormData({
                            ...listingFormData,
                            selectedCategories: listingFormData.selectedCategories.filter(c => c !== cat.value)
                          })
                        } else if (listingFormData.selectedCategories.length < 3) {
                          setListingFormData({
                            ...listingFormData,
                            selectedCategories: [...listingFormData.selectedCategories, cat.value]
                          })
                        }
                      }}
                      style={{
                        padding: '8px 16px',
                        background: isSelected ? colors.accentSoft : colors.bgSecondary,
                        border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                        borderRadius: '3px',
                        color: isSelected ? colors.accent : colors.textSecondary,
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* STEP 3 - Specific topics */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Specific topics <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                value={listingFormData.topic}
                onChange={(e) => setListingFormData({ ...listingFormData, topic: e.target.value })}
                placeholder="Separate with commas, e.g., judo, divorce recovery, website building"
                maxLength={200}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* STEP 4 - Price for this offering */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Current session rate <span style={{ color: colors.accent }}>*</span>
              </label>
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: '-4px', marginBottom: '8px' }}>
                per 25-min session ({BLOCK_MINUTES} minutes)
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.5rem', color: colors.textPrimary }}>$</span>
                <input
                  type="number"
                  min="15"
                  step="1"
                  value={listingFormData.price_cents / 100}
                  onChange={(e) => {
                    const dollars = parseFloat(e.target.value) || 15
                    setListingFormData({ ...listingFormData, price_cents: Math.round(dollars * 100) })
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: colors.bgSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '3px',
                    color: colors.textPrimary,
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
            </div>

            {/* STEP 5 - Description */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Why do people leave clearer after talking to you? <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional but recommended)</span>
              </label>
              <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '10px', lineHeight: 1.5 }}>
                What makes you uniquely qualified? What will someone walk away with? Example: "10+ years as a divorce lawyer. I've seen it all and I'll help you see your situation clearly."
              </p>
              <textarea
                value={listingFormData.description}
                onChange={(e) => setListingFormData({ ...listingFormData, description: e.target.value })}
                placeholder="Example: Former Google PM. I'll help you debug your product strategy and ask the hard questions your team won't."
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '3px',
                  color: colors.textPrimary,
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  minHeight: '100px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
              <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: '5px' }}>
                {listingFormData.description.length}/500 characters
              </p>
            </div>

            {/* Submit */}
            <button type="submit" style={btnStyle}>
              Save Changes
            </button>
          </form>

          <Nav />
        </div>
      </div>
    )
  }

  return null
}

export default App
