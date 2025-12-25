// src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import DailyIframe, { DailyCall } from '@daily-co/daily-js'
import Auth from './components/Auth'

// Booking type
interface Booking {
  id: string
  seeker_id: string
  giver_id: string
  scheduled_time: string
  duration_minutes: number
  amount_cents: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  stripe_payment_id: string | null
  video_room_url: string | null
  giver_joined_at: string | null
  created_at: string
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

// Availability structure: day -> array of time slots
type WeeklyAvailability = {
  [day: string]: string[]
}

interface Giver {
  id: string
  name: string
  tagline: string | null
  rate_per_30: number
  qualities_offered?: string[]
  video_url?: string | null
  available?: boolean
  availability_schedule?: WeeklyAvailability
  stripe_account_id?: string | null
  stripe_onboarding_complete?: boolean
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIME_SLOTS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'
]

function App() {
  const { user, loading, signOut } = useAuth()
  const [screen, setScreen] = useState('welcome')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [returnToScreen, setReturnToScreen] = useState('')
  const [selectedGiver, setSelectedGiver] = useState<Giver | null>(null)
  const [givers, setGivers] = useState<Giver[]>(demoGivers)
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date | null>(null)
  const [selectedBookingTime, setSelectedBookingTime] = useState<string>('')

  // Booking/payment state
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvc, setCardCvc] = useState('')

  // Stripe Connect state (for givers)
  const [myGiverProfile, setMyGiverProfile] = useState<Giver | null>(null)
  const [stripeConnectLoading, setStripeConnectLoading] = useState(false)
  const [stripeConnectError, setStripeConnectError] = useState('')

  // Video session state
  const [activeSession, setActiveSession] = useState<Booking | null>(null)
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(30 * 60) // 30 minutes in seconds
  const [showTimeWarning, setShowTimeWarning] = useState(false)
  const [userBookings, setUserBookings] = useState<Booking[]>([])
  const dailyCallRef = useRef<DailyCall | null>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

  // Giver profile form state
  const [giverName, setGiverName] = useState('')
  const [giverTagline, setGiverTagline] = useState('')
  const [giverRate, setGiverRate] = useState(15)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  // Video recording state
  const [videoStep, setVideoStep] = useState<'prompt' | 'recording' | 'preview' | 'done'>('prompt')
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [videoError, setVideoError] = useState('')

  // Availability state
  const [giverAvailability, setGiverAvailability] = useState<WeeklyAvailability>({})
  const [selectedDay, setSelectedDay] = useState<string>('Monday')

  // Saved givers state (private saves for seekers)
  const [savedGiverIds, setSavedGiverIds] = useState<Set<string>>(new Set())
  const [showSavedOnly, setShowSavedOnly] = useState(false)

  // Toggle a time slot for a day
  const toggleTimeSlot = (day: string, time: string) => {
    setGiverAvailability(prev => {
      const daySlots = prev[day] || []
      if (daySlots.includes(time)) {
        return { ...prev, [day]: daySlots.filter(t => t !== time) }
      } else {
        return { ...prev, [day]: [...daySlots, time].sort((a, b) => {
          const timeToMinutes = (t: string) => {
            const [time, period] = t.split(' ')
            const [hours, minutes] = time.split(':').map(Number)
            return (hours % 12 + (period === 'PM' ? 12 : 0)) * 60 + minutes
          }
          return timeToMinutes(a) - timeToMinutes(b)
        })}
      }
    })
  }

  // Get total slots selected
  const getTotalSlots = () => {
    return Object.values(giverAvailability).reduce((sum, slots) => sum + slots.length, 0)
  }

  // Get available dates for a giver (next 7 days)
  const getAvailableDates = (schedule: WeeklyAvailability | undefined) => {
    if (!schedule) return []

    const dates: { date: Date; dayName: string; slots: string[] }[] = []
    const today = new Date()

    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      const dayName = DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1] // Adjust for Monday start
      const slots = schedule[dayName] || []

      if (slots.length > 0) {
        dates.push({ date, dayName, slots })
      }
    }

    return dates
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
    return `${date.toLocaleDateString('en-US', options)} at ${time}`
  }

  // Convert time string to scheduled datetime
  const getScheduledTime = (date: Date, time: string): string => {
    const [timeStr, period] = time.split(' ')
    const [hours, minutes] = timeStr.split(':').map(Number)
    const hour24 = period === 'PM' ? (hours % 12) + 12 : hours % 12

    const scheduled = new Date(date)
    scheduled.setHours(hour24, minutes, 0, 0)
    return scheduled.toISOString()
  }

  // Create a booking
  const createBooking = async () => {
    if (!user || !selectedGiver || !selectedBookingDate || !selectedBookingTime) return

    setBookingLoading(true)
    setBookingError('')

    try {
      const scheduledTime = getScheduledTime(selectedBookingDate, selectedBookingTime)
      const amountCents = selectedGiver.rate_per_30 * 100

      // Create booking record
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          seeker_id: user.id,
          giver_id: selectedGiver.id,
          scheduled_time: scheduledTime,
          duration_minutes: 30,
          amount_cents: amountCents,
          status: 'pending',
          stripe_payment_id: null,
          video_room_url: null,
        })
        .select()
        .single()

      if (error) throw error

      setCurrentBooking(data)
      setScreen('payment')
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Failed to create booking')
    } finally {
      setBookingLoading(false)
    }
  }

  // Process payment and confirm booking
  const processPayment = async () => {
    if (!currentBooking || !user) return

    setBookingLoading(true)
    setBookingError('')

    try {
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

      // In production, this would:
      // 1. Create a PaymentIntent on the backend
      // 2. Confirm payment with Stripe
      // 3. Update booking with payment ID
      // For now, we simulate the payment and update booking status

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Generate a mock payment ID for demo
      const mockPaymentId = `pi_demo_${Date.now()}`

      // Create Daily.co room for the video session
      let videoRoomUrl: string | null = null
      try {
        videoRoomUrl = await createDailyRoom()
      } catch (roomError) {
        console.error('Failed to create video room:', roomError)
        // Continue without room - can be created later
      }

      // Update booking to confirmed with video room URL
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          stripe_payment_id: mockPaymentId,
          video_room_url: videoRoomUrl,
        })
        .eq('id', currentBooking.id)

      if (error) throw error

      // Update local booking state
      setCurrentBooking({
        ...currentBooking,
        status: 'confirmed',
        stripe_payment_id: mockPaymentId,
        video_room_url: videoRoomUrl,
      })

      // Clear card inputs
      setCardNumber('')
      setCardExpiry('')
      setCardCvc('')

      // Go to confirmation
      setScreen('confirmation')
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setBookingLoading(false)
    }
  }

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

  // Fetch givers from database
  const fetchGivers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_giver', true)

      if (error) throw error
      if (data && data.length > 0) {
        // Merge with demo givers, real profiles first
        setGivers([...data, ...demoGivers])
      }
    } catch {
      // Keep demo givers on error
    }
  }, [])

  useEffect(() => {
    fetchGivers()
  }, [fetchGivers])

  // Fetch current user's giver profile
  const fetchMyGiverProfile = useCallback(async () => {
    if (!user) {
      setMyGiverProfile(null)
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .eq('is_giver', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
      setMyGiverProfile(data || null)
    } catch {
      setMyGiverProfile(null)
    }
  }, [user])

  useEffect(() => {
    fetchMyGiverProfile()
  }, [fetchMyGiverProfile])

  // Start Stripe Connect onboarding
  const startStripeConnect = async () => {
    if (!user || !myGiverProfile) return

    setStripeConnectLoading(true)
    setStripeConnectError('')

    try {
      // In production, this would:
      // 1. Call your backend to create a Stripe Connect account
      // 2. Get an account link URL
      // 3. Redirect user to Stripe for onboarding
      // 4. Handle the return URL to verify completion

      // For demo, we simulate the process
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Generate a mock Stripe account ID
      const mockAccountId = `acct_demo_${Date.now()}`

      // Update the profile with Stripe account info
      const { error } = await supabase
        .from('profiles')
        .update({
          stripe_account_id: mockAccountId,
          stripe_onboarding_complete: true,
        })
        .eq('id', user.id)

      if (error) throw error

      // Update local state
      setMyGiverProfile({
        ...myGiverProfile,
        stripe_account_id: mockAccountId,
        stripe_onboarding_complete: true,
      })

      // Go to confirmation
      setScreen('payoutSetupComplete')
    } catch (err) {
      setStripeConnectError(err instanceof Error ? err.message : 'Failed to set up payouts')
    } finally {
      setStripeConnectLoading(false)
    }
  }

  // Create Daily.co room for a booking
  const createDailyRoom = async (): Promise<string> => {
    // Call backend API to create Daily room (expires in 35 minutes, max 2 participants)
    const response = await fetch('/api/create-room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to create video room')
    }

    const { roomUrl } = await response.json()
    return roomUrl
  }

  // Fetch user's bookings
  const fetchUserBookings = useCallback(async () => {
    if (!user) {
      setUserBookings([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .or(`seeker_id.eq.${user.id},giver_id.eq.${user.id}`)
        .in('status', ['confirmed', 'pending'])
        .order('scheduled_time', { ascending: true })

      if (error) throw error
      setUserBookings(data || [])
    } catch {
      setUserBookings([])
    }
  }, [user])

  useEffect(() => {
    fetchUserBookings()
  }, [fetchUserBookings])

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
    if (!booking.video_room_url) {
      console.error('No video room URL')
      return
    }

    // Track when giver joins (for lateness detection)
    if (user && user.id === booking.giver_id) {
      await supabase
        .from('bookings')
        .update({ giver_joined_at: new Date().toISOString() })
        .eq('id', booking.id)
    }

    setActiveSession(booking)
    setSessionTimeRemaining(30 * 60)
    setShowTimeWarning(false)
    setScreen('videoSession')
  }

  // Start the Daily call
  const startDailyCall = useCallback(async () => {
    if (!activeSession?.video_room_url || !videoContainerRef.current) return

    try {
      // Destroy existing call if any
      if (dailyCallRef.current) {
        await dailyCallRef.current.destroy()
      }

      // Create new Daily call
      const call = DailyIframe.createFrame(videoContainerRef.current, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: '0',
          borderRadius: '16px',
        },
        showLeaveButton: false,
        showFullscreenButton: true,
      })

      dailyCallRef.current = call

      await call.join({ url: activeSession.video_room_url })
    } catch (err) {
      console.error('Failed to join call:', err)
    }
  }, [activeSession])

  // Leave the video session
  const leaveSession = async (markComplete: boolean = false) => {
    // Destroy Daily call
    if (dailyCallRef.current) {
      await dailyCallRef.current.destroy()
      dailyCallRef.current = null
    }

    // Mark session as completed if time expired
    if (markComplete && activeSession) {
      await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', activeSession.id)

      // Refresh bookings
      fetchUserBookings()
    }

    setActiveSession(null)
    setSessionTimeRemaining(30 * 60)
    setShowTimeWarning(false)
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

  // Session timer effect
  useEffect(() => {
    if (!activeSession || screen !== 'videoSession') return

    const timer = setInterval(() => {
      setSessionTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto disconnect (hard stop)
          clearInterval(timer)
          leaveSession(true)
          return 0
        }

        // Gentle audio cue at 15 minutes (halfway)
        if (prev === 15 * 60) {
          playChime()
        }

        // Gentle audio cue at 5 minutes
        if (prev === 5 * 60) {
          playChime()
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [activeSession, screen, leaveSession, playChime])

  // Start Daily call when entering video session
  useEffect(() => {
    if (screen === 'videoSession' && activeSession) {
      startDailyCall()
    }
  }, [screen, activeSession, startDailyCall])

  // Format remaining time
  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Check if a booking is joinable (at or after scheduled time, within 30-min window)
  const isSessionJoinable = (booking: Booking) => {
    const scheduledTime = new Date(booking.scheduled_time).getTime()
    const now = Date.now()
    const thirtyMinutesAfter = scheduledTime + 30 * 60 * 1000

    // Joinable exactly at scheduled time or after (if joining late)
    // Session ends 30 minutes after scheduled time regardless of when joined
    return now >= scheduledTime && now <= thirtyMinutesAfter
  }

  // Create giver profile
  const createGiverProfile = async () => {
    if (!user) return

    // Validation
    if (!giverName.trim()) {
      setProfileError('Please enter your name')
      return
    }
    if (giverRate < 15) {
      setProfileError('Minimum rate is $15 per 30 minutes')
      return
    }
    if (getTotalSlots() === 0) {
      setProfileError('Please select at least one availability time slot')
      return
    }

    setProfileLoading(true)
    setProfileError('')

    try {
      // Upload video if recorded (optional)
      const videoUrl = recordedBlob ? await uploadVideo() : null

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          name: giverName.trim(),
          tagline: giverTagline.trim() || null,
          video_url: videoUrl,
          rate_per_30: giverRate,
          is_giver: true,
          available: true,
          qualities_offered: [],
          availability_schedule: giverAvailability,
        }, { onConflict: 'id' })

      if (error) throw error

      // Refresh givers list and user's giver profile
      await fetchGivers()
      await fetchMyGiverProfile()

      // Go to payout setup (Stripe Connect)
      setScreen('payoutSetup')

      // Reset form
      setGiverName('')
      setGiverTagline('')
      setGiverRate(15)
      setRecordedBlob(null)
      setRecordedUrl(null)
      setVideoStep('prompt')
      setGiverAvailability({})
      setSelectedDay('Monday')
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
            {!user && (
              <button 
                style={{ 
                  ...btnSecondaryStyle, 
                  marginBottom: 0,
                  marginTop: '10px',
                  fontSize: '0.9rem'
                }} 
                onClick={() => setNeedsAuth(true)}
              >
                Sign In
              </button>
            )}
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
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button onClick={() => setScreen('welcome')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Find Presence</h2>
            <div style={{ width: '40px' }} />
          </div>

          {/* Saved filter toggle */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={() => setShowSavedOnly(false)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: `1px solid ${!showSavedOnly ? colors.accent : colors.border}`,
                background: !showSavedOnly ? colors.accentSoft : 'transparent',
                color: !showSavedOnly ? colors.accent : colors.textSecondary,
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              All
            </button>
            <button
              onClick={() => setShowSavedOnly(true)}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: `1px solid ${showSavedOnly ? colors.accent : colors.border}`,
                background: showSavedOnly ? colors.accentSoft : 'transparent',
                color: showSavedOnly ? colors.accent : colors.textSecondary,
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '0.9rem' }}>♥</span>
              Saved {savedGiverIds.size > 0 && `(${savedGiverIds.size})`}
            </button>
          </div>

          {givers.filter(g => !showSavedOnly || savedGiverIds.has(g.id)).map(giver => (
            <div key={giver.id} style={cardStyle} onClick={() => { setSelectedGiver(giver); setScreen('profile'); }}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                {giver.video_url ? (
                  <div style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    flexShrink: 0
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
                      background: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        background: 'rgba(255,255,255,0.9)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <div style={{
                          width: 0,
                          height: 0,
                          borderLeft: '8px solid #333',
                          borderTop: '5px solid transparent',
                          borderBottom: '5px solid transparent',
                          marginLeft: '2px'
                        }} />
                      </div>
                    </div>
                  </div>
                ) : (
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
                    flexShrink: 0
                  }}>
                    {giver.name[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '5px', fontFamily: 'Georgia, serif' }}>{giver.name}</h3>
                  <p style={{ fontSize: '0.9rem', color: colors.textSecondary }}>{giver.tagline}</p>
                </div>
              </div>
              <div style={{ marginBottom: '15px' }}>
                {(giver.qualities_offered || []).slice(0, 3).map((q, i) => (
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
                  <div><span style={{ width: '10px', height: '10px', background: colors.success, borderRadius: '50%', display: 'inline-block', marginRight: '8px' }} />Available</div>
                </div>
              </div>
            </div>
          ))}

          {/* Empty state for saved filter */}
          {showSavedOnly && givers.filter(g => savedGiverIds.has(g.id)).length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.textMuted }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>♡</div>
              <p style={{ marginBottom: '10px' }}>No saved givers yet</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '20px' }}>
                Tap the heart on any giver to save them for later.
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

  if (screen === 'profile' && selectedGiver) {
    const availableDates = getAvailableDates(selectedGiver.availability_schedule)
    const selectedDateSlots = availableDates.find(d =>
      selectedBookingDate && d.date.toDateString() === selectedBookingDate.toDateString()
    )?.slots || []
    const price = selectedGiver.rate_per_30

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
                borderRadius: '16px',
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
                fontFamily: 'Georgia, serif',
                fontSize: '2.5rem',
                color: colors.accent,
                border: `3px solid ${colors.accent}`,
              }}>
                {selectedGiver.name[0]}
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '2rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>{selectedGiver.name}</h1>
              <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>{selectedGiver.tagline}</p>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.accent }}>${selectedGiver.rate_per_30} <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: '1rem' }}>/ 30 min</span></div>
            </div>
          </div>

          {/* Weekly availability schedule */}
          {selectedGiver.availability_schedule && Object.keys(selectedGiver.availability_schedule).some(day => (selectedGiver.availability_schedule?.[day] || []).length > 0) && (
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif', color: colors.textSecondary }}>Weekly Availability</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {DAYS_OF_WEEK.filter(day => (selectedGiver.availability_schedule?.[day] || []).length > 0).map(day => (
                  <div key={day} style={{
                    padding: '8px 12px',
                    background: colors.bgSecondary,
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}>
                    <span style={{ color: colors.accent, fontWeight: 500 }}>{day.slice(0, 3)}</span>
                    <span style={{ color: colors.textMuted, marginLeft: '6px' }}>
                      {(selectedGiver.availability_schedule?.[day] || []).length} slots
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...cardStyle, cursor: 'default' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', fontFamily: 'Georgia, serif' }}>Book a 30-minute session</h3>

            {availableDates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: colors.textSecondary }}>
                <p>No available times this week.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '10px' }}>Check back later for updated availability.</p>
              </div>
            ) : (
              <>
                <p style={{ color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Select a date</p>
                <div style={{
                  display: 'flex',
                  gap: '10px',
                  overflowX: 'auto',
                  paddingBottom: '10px',
                  marginBottom: '20px'
                }}>
                  {availableDates.map(({ date, slots }) => (
                    <div
                      key={date.toISOString()}
                      onClick={() => {
                        setSelectedBookingDate(date)
                        setSelectedBookingTime('')
                      }}
                      style={{
                        minWidth: '80px',
                        padding: '15px 12px',
                        background: selectedBookingDate?.toDateString() === date.toDateString()
                          ? colors.accentSoft : colors.bgSecondary,
                        border: `1px solid ${selectedBookingDate?.toDateString() === date.toDateString()
                          ? colors.accent : colors.border}`,
                        borderRadius: '12px',
                        textAlign: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: selectedBookingDate?.toDateString() === date.toDateString()
                          ? colors.accent : colors.textPrimary
                      }}>
                        {formatDate(date)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '4px' }}>
                        {slots.length} slot{slots.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedBookingDate && selectedDateSlots.length > 0 && (
                  <>
                    <p style={{ color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Select a time</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                      {selectedDateSlots.map(t => (
                        <div
                          key={t}
                          onClick={() => setSelectedBookingTime(t)}
                          style={{
                            padding: '12px',
                            background: selectedBookingTime === t ? colors.accentSoft : colors.bgSecondary,
                            border: `1px solid ${selectedBookingTime === t ? colors.accent : colors.border}`,
                            borderRadius: '12px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            color: selectedBookingTime === t ? colors.accent : colors.textPrimary,
                            fontSize: '0.9rem',
                          }}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {bookingError && (
                  <div style={{
                    padding: '12px',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '12px',
                    color: '#f87171',
                    marginBottom: '15px',
                    fontSize: '0.85rem'
                  }}>
                    {bookingError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 0', borderTop: `1px solid ${colors.border}` }}>
                  <span style={{ color: colors.textSecondary }}>30 minutes</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 600 }}>${price}</span>
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
                  {bookingLoading ? 'Processing...' : 'Book Session'}
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
    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '15px',
      background: colors.bgSecondary,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      color: colors.textPrimary,
      fontSize: '1rem',
      boxSizing: 'border-box'
    }

    return (
      <div style={containerStyle}>
        <div style={{ ...screenStyle, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
            <button
              onClick={() => {
                setScreen('profile')
                setCurrentBooking(null)
              }}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}
            >←</button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Complete Payment</h2>
            <div style={{ width: '40px' }} />
          </div>

          {/* Booking Summary */}
          <div style={{
            ...cardStyle,
            cursor: 'default',
            marginBottom: '25px'
          }}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${colors.accentSoft}, ${colors.bgSecondary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Georgia, serif',
                fontSize: '1.3rem',
                color: colors.accent,
              }}>
                {selectedGiver.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '5px', fontFamily: 'Georgia, serif' }}>{selectedGiver.name}</h3>
                <p style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                  {formatFullDate(selectedBookingDate, selectedBookingTime)}
                </p>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: colors.textSecondary }}>30-minute session</span>
                <span>${selectedGiver.rate_per_30}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: colors.textMuted }}>Platform fee</span>
                <span style={{ color: colors.textMuted }}>${Math.round(selectedGiver.rate_per_30 * 0.15)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, paddingTop: '8px', borderTop: `1px solid ${colors.border}` }}>
                <span>Total</span>
                <span>${selectedGiver.rate_per_30 + Math.round(selectedGiver.rate_per_30 * 0.15)}</span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div style={{ ...cardStyle, cursor: 'default' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', fontFamily: 'Georgia, serif' }}>Payment Details</h3>

            {bookingError && (
              <div style={{
                padding: '12px',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '12px',
                color: '#f87171',
                marginBottom: '20px',
                fontSize: '0.85rem'
              }}>
                {bookingError}
              </div>
            )}

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>Card number</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>Expiry</label>
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
                <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>CVC</label>
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

            <p style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '20px', textAlign: 'center' }}>
              Payment is held until the session completes, then released to {selectedGiver.name}.
            </p>

            <button
              style={{
                ...btnStyle,
                opacity: bookingLoading ? 0.7 : 1,
                cursor: bookingLoading ? 'not-allowed' : 'pointer'
              }}
              onClick={processPayment}
              disabled={bookingLoading}
            >
              {bookingLoading ? 'Processing...' : `Pay $${selectedGiver.rate_per_30 + Math.round(selectedGiver.rate_per_30 * 0.15)}`}
            </button>

            <p style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '15px', textAlign: 'center' }}>
              For testing, use card: 4242 4242 4242 4242
            </p>
          </div>
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
          <p style={{ color: colors.textSecondary, marginBottom: '10px' }}>
            Your session with {selectedGiver?.name} is confirmed.
          </p>
          {selectedBookingDate && selectedBookingTime && (
            <p style={{ color: colors.accent, fontSize: '1.1rem', fontWeight: 500, marginBottom: '30px' }}>
              {formatFullDate(selectedBookingDate, selectedBookingTime)}
            </p>
          )}
          <p style={{ color: colors.textMuted, fontSize: '0.9rem', marginBottom: '30px', maxWidth: '300px' }}>
            You'll receive a reminder before your session. The video room will be available at your scheduled time.
          </p>
          {currentBooking?.video_room_url && (
            <>
              <button
                disabled={!isSessionJoinable(currentBooking)}
                style={{
                  ...btnStyle,
                  maxWidth: '320px',
                  marginBottom: '10px',
                  opacity: isSessionJoinable(currentBooking) ? 1 : 0.5,
                  cursor: isSessionJoinable(currentBooking) ? 'pointer' : 'not-allowed',
                }}
                onClick={() => currentBooking && isSessionJoinable(currentBooking) && joinSession(currentBooking)}
              >
                Join Session
              </button>
              {!isSessionJoinable(currentBooking) && (
                <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '20px', maxWidth: '320px' }}>
                  Session will be available at your scheduled time
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
            View My Sessions
          </button>
          <button
            style={{ ...btnSecondaryStyle, maxWidth: '320px', marginTop: '10px' }}
            onClick={() => {
              setScreen('browse')
              setSelectedBookingDate(null)
              setSelectedBookingTime('')
              setCurrentBooking(null)
            }}
          >
            Browse More Givers
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
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Before You Begin</h2>
            <div style={{ width: '40px' }} />
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '15px', fontFamily: 'Georgia, serif', color: colors.accent }}>
              What happens when you do this:
            </h3>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0' }}>
              For this session, your role is simply to be present. Your life pauses. You get to witness someone's actual experience. You learn how other people carry what they carry. You discover that you don't need to fix anything to be valuable. You finish a little more connected and a little less stuck in your own loop.
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
            <Auth onBack={() => setScreen('giverIntro')} />
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
          
          {profileError && (
            <div style={{
              padding: '15px',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid rgba(220, 38, 38, 0.3)',
              borderRadius: '12px',
              color: '#f87171',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              {profileError}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Your name *</label>
            <input
              value={giverName}
              onChange={(e) => setGiverName(e.target.value)}
              style={{ width: '100%', padding: '15px', background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textPrimary, fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="How should people know you?"
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Your tagline</label>
            <input
              value={giverTagline}
              onChange={(e) => setGiverTagline(e.target.value)}
              style={{ width: '100%', padding: '15px', background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: '12px', color: colors.textPrimary, fontSize: '1rem', boxSizing: 'border-box' }}
              placeholder="One sentence about your presence..."
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Rate per 30 minutes *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: colors.textPrimary, fontSize: '1.2rem' }}>$</span>
              <input
                type="number"
                min={15}
                value={giverRate}
                onChange={(e) => setGiverRate(Math.max(15, parseInt(e.target.value) || 15))}
                style={{
                  flex: 1,
                  padding: '15px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  color: colors.textPrimary,
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '8px' }}>Minimum $15</p>
          </div>

          {/* Video Recording Section */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Introduction video <span style={{ color: colors.textMuted }}>(optional, 30-90 seconds)</span>
            </label>

            {videoError && (
              <div style={{
                padding: '12px',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '12px',
                color: '#f87171',
                marginBottom: '15px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px'
              }}>
                <span>{videoError}</span>
                <button
                  onClick={() => startRecording()}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(220, 38, 38, 0.2)',
                    border: '1px solid rgba(220, 38, 38, 0.4)',
                    borderRadius: '6px',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
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
                borderRadius: '16px',
                padding: '25px',
                textAlign: 'center'
              }}>
                <div style={{
                  background: colors.accentSoft,
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <p style={{
                    color: colors.textPrimary,
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                    margin: 0
                  }}>
                    "In this space, my role is to offer presence without directing, fixing, or advancing an agenda. This is how I personally hold that."
                  </p>
                </div>
                <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '20px' }}>
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
                borderRadius: '16px',
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
                    borderRadius: '20px'
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
                    borderRadius: '20px',
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
                borderRadius: '16px',
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
                borderRadius: '16px',
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

          {/* Availability Section */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Weekly availability * <span style={{ color: colors.textMuted }}>({getTotalSlots()} slots selected)</span>
            </label>

            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '16px',
              padding: '20px'
            }}>
              {/* Day selector */}
              <div style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingBottom: '15px',
                marginBottom: '15px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                {DAYS_OF_WEEK.map(day => {
                  const daySlots = giverAvailability[day] || []
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: selectedDay === day ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
                        background: selectedDay === day ? colors.accentSoft : colors.bgSecondary,
                        color: selectedDay === day ? colors.accent : colors.textPrimary,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        position: 'relative'
                      }}
                    >
                      {day.slice(0, 3)}
                      {daySlots.length > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: '-5px',
                          right: '-5px',
                          background: colors.accent,
                          color: colors.bgPrimary,
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600
                        }}>
                          {daySlots.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Time slots for selected day */}
              <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '12px' }}>
                Select your available 30-minute slots for {selectedDay}:
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px'
              }}>
                {TIME_SLOTS.map(time => {
                  const isSelected = (giverAvailability[selectedDay] || []).includes(time)
                  return (
                    <button
                      key={time}
                      onClick={() => toggleTimeSlot(selectedDay, time)}
                      style={{
                        padding: '10px 6px',
                        borderRadius: '8px',
                        border: isSelected ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
                        background: isSelected ? colors.accentSoft : colors.bgSecondary,
                        color: isSelected ? colors.accent : colors.textPrimary,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: isSelected ? 600 : 400
                      }}
                    >
                      {time}
                    </button>
                  )
                })}
              </div>

              {/* Quick summary */}
              {getTotalSlots() > 0 && (
                <div style={{
                  marginTop: '15px',
                  paddingTop: '15px',
                  borderTop: `1px solid ${colors.border}`,
                  fontSize: '0.85rem',
                  color: colors.textSecondary
                }}>
                  <strong style={{ color: colors.textPrimary }}>Your schedule:</strong>
                  <div style={{ marginTop: '8px' }}>
                    {DAYS_OF_WEEK.filter(day => (giverAvailability[day] || []).length > 0).map(day => (
                      <div key={day} style={{ marginBottom: '4px' }}>
                        <span style={{ color: colors.accent }}>{day}:</span>{' '}
                        {(giverAvailability[day] || []).join(', ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Set Up Payouts</h2>
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
            <h3 style={{ fontSize: '1.3rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>
              Almost there!
            </h3>
            <p style={{ color: colors.textSecondary, maxWidth: '320px', margin: '0 auto' }}>
              Connect your bank account to receive payments from your sessions.
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
          <h1 style={{ fontSize: '2rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Payouts Connected</h1>
          <p style={{ color: colors.textSecondary, marginBottom: '10px' }}>
            You're all set to receive payments!
          </p>
          <p style={{ color: colors.accent, fontSize: '1.1rem', fontWeight: 500, marginBottom: '30px' }}>
            You receive ${myGiverProfile?.rate_per_30} per session
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
          <h1 style={{ fontSize: '2rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>You're Live</h1>
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
                  borderRadius: '8px',
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
            View My Sessions
          </button>
          <button
            style={{ ...btnSecondaryStyle, maxWidth: '320px', marginTop: '10px' }}
            onClick={() => setScreen('browse')}
          >
            Browse Other Givers
          </button>
        </div>
      </div>
    )
  }

  // Video session screen
  if (screen === 'videoSession' && activeSession) {
    return (
      <div style={{
        ...containerStyle,
        maxWidth: '100%',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Daily video container */}
        <div
          ref={videoContainerRef}
          style={{
            width: '100%',
            height: '100%',
            background: colors.bgSecondary,
          }}
        />

        {/* Leave session button */}
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
        }}>
          <button
            onClick={() => leaveSession(false)}
            style={{
              background: 'rgba(201, 107, 107, 0.9)',
              color: '#fff',
              border: 'none',
              padding: '15px 40px',
              borderRadius: '30px',
              fontSize: '1rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>📞</span>
            Leave Session
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

          <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif', textAlign: 'center', marginBottom: '30px' }}>Your Sessions</h2>

          {/* Giver payout status card */}
          {myGiverProfile && (
            <div style={{
              ...cardStyle,
              cursor: 'default',
              marginBottom: '25px',
              background: myGiverProfile.stripe_onboarding_complete
                ? `linear-gradient(135deg, rgba(74, 156, 109, 0.1), ${colors.bgCard})`
                : `linear-gradient(135deg, rgba(201, 166, 107, 0.1), ${colors.bgCard})`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '5px' }}>Giver Payouts</h4>
                  {myGiverProfile.stripe_onboarding_complete ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: colors.success }}>
                      <span>✓</span>
                      <span style={{ fontSize: '0.85rem' }}>Connected</span>
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: colors.accent }}>Setup required</p>
                  )}
                </div>
                {!myGiverProfile.stripe_onboarding_complete && (
                  <button
                    style={{
                      padding: '8px 16px',
                      background: colors.accent,
                      color: colors.bgPrimary,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}
                    onClick={() => setScreen('payoutSetup')}
                  >
                    Set Up
                  </button>
                )}
                {myGiverProfile.stripe_onboarding_complete && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.85rem', color: colors.textSecondary }}>You receive</p>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: colors.success }}>
                      ${myGiverProfile.rate_per_30}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sessions list */}
          {userBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: colors.textMuted }}>
              <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📅</div>
              <p style={{ marginBottom: '10px' }}>No sessions yet</p>
              <p style={{ fontSize: '0.85rem', marginBottom: '30px' }}>
                {myGiverProfile
                  ? 'When someone books a session with you, it will appear here.'
                  : 'Book a session with a giver to get started.'}
              </p>
              <button
                style={{ ...btnStyle, maxWidth: '200px' }}
                onClick={() => setScreen('browse')}
              >
                {myGiverProfile ? 'Browse Givers' : 'Find Someone'}
              </button>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: '1rem', color: colors.textSecondary, marginBottom: '15px' }}>
                Upcoming Sessions
              </h3>
              {userBookings.map(booking => {
                const scheduledDate = new Date(booking.scheduled_time)
                const isGiver = booking.giver_id === user?.id
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: isGiver ? colors.success : colors.accent,
                          marginBottom: '5px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {isGiver ? 'You are giving' : 'You booked'}
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>
                          30-minute session
                        </div>
                      </div>
                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        background: booking.status === 'confirmed' ? colors.accentSoft : colors.bgSecondary,
                        color: booking.status === 'confirmed' ? colors.accent : colors.textMuted,
                      }}>
                        {booking.status === 'confirmed' ? 'Confirmed' : booking.status}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px',
                      background: colors.bgSecondary,
                      borderRadius: '10px',
                      marginBottom: '15px',
                    }}>
                      <div style={{ fontSize: '1.5rem' }}>📅</div>
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {scheduledDate.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: colors.textSecondary }}>
                          {scheduledDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </div>
                      </div>
                    </div>

                    {booking.status === 'confirmed' && booking.video_room_url && (
                      <button
                        onClick={() => joinable && joinSession(booking)}
                        disabled={!joinable}
                        style={{
                          width: '100%',
                          padding: '14px',
                          borderRadius: '10px',
                          border: 'none',
                          fontSize: '1rem',
                          fontWeight: 500,
                          cursor: joinable ? 'pointer' : 'not-allowed',
                          background: joinable ? colors.success : colors.bgSecondary,
                          color: joinable ? '#fff' : colors.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                        }}
                      >
                        {joinable ? (
                          <>
                            <span>🎥</span>
                            Join Session
                          </>
                        ) : isPast ? (
                          'Session ended'
                        ) : (
                          `Opens ${scheduledDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          })} (5 min before)`
                        )}
                      </button>
                    )}
                  </div>
                )
              })}

              <button
                style={{ ...btnSecondaryStyle, marginTop: '20px' }}
                onClick={() => setScreen('browse')}
              >
                Book Another Session
              </button>
            </div>
          )}
          <Nav />
        </div>
      </div>
    )
  }

  return null
}

export default App
