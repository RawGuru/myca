// src/App.tsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import DailyIframe, { DailyCall } from '@daily-co/daily-js'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import Auth from './components/Auth'

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
  is_active: boolean
  created_at: string
  updated_at: string
  categories?: Category[]
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

// Booking type (updated for multi-listing)
interface Booking {
  id: string
  seeker_id: string
  giver_id: string
  listing_id: string
  scheduled_time: string
  blocks_booked: number
  duration_minutes: number
  amount_cents: number
  total_amount_cents: number
  platform_fee_cents: number
  giver_payout_cents: number
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  stripe_payment_id: string | null
  stripe_payment_intent_id: string | null
  video_room_url: string | null
  giver_joined_at: string | null
  seeker_joined_at: string | null
  giver_left_at: string | null
  seeker_left_at: string | null
  session_started_at: string | null
  session_ended_at: string | null
  extended_count: number
  cancelled_by: 'giver' | 'seeker' | 'system' | null
  cancelled_at: string | null
  refund_issued: boolean
  seeker_credit_earned: boolean
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
  rate_per_30: number
  qualities_offered?: string[]
  bio?: string | null
  video_url?: string | null
  available?: boolean
  stripe_account_id?: string | null
  stripe_onboarding_complete?: boolean
  timezone?: string
  total_sessions_completed?: number
  times_joined_late?: number
  listings?: Listing[] // Multi-listing architecture
  twitter_handle?: string | null
  instagram_handle?: string | null
  linkedin_handle?: string | null
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

// Predefined qualities for giver profiles
const QUALITIES = [
  'Present',
  'Warm',
  'Patient',
  'Calming',
  'Insightful',
  'Honest',
  'Encouraging',
  'Compassionate',
  'Non-judgmental',
  'Empathetic',
  'Grounded',
  'Wise',
]

// Modes of interaction
export const MODES: { value: Mode; label: string; description: string }[] = [
  { value: 'vault', label: 'The Vault', description: 'Pure listening. No advice.' },
  { value: 'mirror', label: 'The Mirror', description: 'Reflective listening to help you see yourself.' },
  { value: 'strategist', label: 'The Strategist', description: 'Active problem solving and brainstorming.' },
  { value: 'teacher', label: 'The Teacher', description: 'Instruction and skill transfer.' },
  { value: 'challenger', label: 'The Challenger', description: 'Debate and challenge assumptions.' },
  { value: 'vibe_check', label: 'The Vibe Check', description: 'Casual conversation and chemistry test.' },
]

// Categories for listings
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'health', label: 'Health & Wellness' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'creativity', label: 'Creativity' },
  { value: 'career_money', label: 'Career & Money' },
  { value: 'life_transitions', label: 'Life Transitions' },
  { value: 'spirituality', label: 'Spirituality' },
  { value: 'general', label: 'General' },
]

// Time physics constants
export const ACTIVE_MINUTES_PER_BLOCK = 25
export const BUFFER_MINUTES = 5
export const TOTAL_BLOCK_MINUTES = 30

function App() {
  const { user, loading, signOut } = useAuth()
  const [screen, setScreen] = useState('welcome')
  const [needsAuth, setNeedsAuth] = useState(false)
  const [returnToScreen, setReturnToScreen] = useState('')
  const [selectedGiver, setSelectedGiver] = useState<Giver | null>(null)
  const [givers, setGivers] = useState<Giver[]>(demoGivers)
  const [selectedBookingDate, setSelectedBookingDate] = useState<Date | null>(null)
  const [selectedBookingTime, setSelectedBookingTime] = useState<string>('')
  const [selectedListingForBooking, setSelectedListingForBooking] = useState<Listing | null>(null)
  const [blocksBooked, setBlocksBooked] = useState<1 | 2 | 3>(1) // Multi-block booking (Phase 4)

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
  const [_sessionTimeRemaining, setSessionTimeRemaining] = useState(30 * 60) // 30 minutes in seconds (internal only, not displayed)
  const [_showTimeWarning, setShowTimeWarning] = useState(false) // Internal state, not displayed per constitution
  const [showCountdown, setShowCountdown] = useState(false) // 30-second countdown overlay (Phase 5)
  const [userBookings, setUserBookings] = useState<Booking[]>([])
  const [showGiverOverlay, setShowGiverOverlay] = useState(false)

  // Extension system state (Phase 6)
  const [extensionOffered, setExtensionOffered] = useState(false)
  const [showExtensionUI, setShowExtensionUI] = useState(false)
  const [myExtensionResponse, setMyExtensionResponse] = useState<'yes' | 'no' | null>(null)
  const [otherPartyExtensionResponse, setOtherPartyExtensionResponse] = useState<'yes' | 'no' | null>(null)
  const [extensionTimeRemaining, setExtensionTimeRemaining] = useState(60) // 60-second window
  const [extensionProcessing, setExtensionProcessing] = useState(false)

  // Feedback system state (Phase 8)
  const [feedbackBooking, setFeedbackBooking] = useState<Booking | null>(null)
  const [wouldBookAgain, setWouldBookAgain] = useState<boolean | null>(null)
  const [matchedMode, setMatchedMode] = useState<boolean | null>(null)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)

  const dailyCallRef = useRef<DailyCall | null>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const previewVideoRef = useRef<HTMLVideoElement>(null)

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

  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)

  // Video recording state
  const [videoStep, setVideoStep] = useState<'prompt' | 'recording' | 'preview' | 'done'>('done')
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
    selectedCategories: [] as Category[]
  })

  // Add availability slot (specific date + time)
  const addAvailabilitySlot = async () => {
    if (!newSlotDate || !newSlotTime || !user) return

    try {
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

      if (error) throw error

      setAvailabilitySlots(prev => [...prev, data])
      setNewSlotDate('')
      setNewSlotTime('9:00')
    } catch (err) {
      console.error('Error adding availability slot:', err)
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

      // First get existing slots for this date range to avoid duplicates
      const { data: existing } = await supabase
        .from('giver_availability')
        .select('date, time')
        .eq('giver_id', user.id)
        .gte('date', bulkStartDate)
        .lte('date', bulkEndDate)

      const existingSet = new Set(existing?.map(e => `${e.date}-${e.time}`) || [])
      const newSlots = slotsToInsert.filter(s => !existingSet.has(`${s.date}-${s.time}`))

      if (newSlots.length === 0) {
        alert('All selected slots already exist in your availability.')
        return
      }

      // Insert only new slots
      const { data, error } = await supabase
        .from('giver_availability')
        .insert(newSlots)
        .select()

      if (error) throw error

      setAvailabilitySlots(prev => [...prev, ...data])

      // Show detailed success message
      const startDateObj = new Date(bulkStartDate + 'T00:00:00')
      const endDateObj = new Date(bulkEndDate + 'T00:00:00')
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const selectedDayNames = Array.from(bulkSelectedDays).sort().map(i => dayNames[i]).join(', ')

      const skippedCount = slotsToInsert.length - newSlots.length
      const message = `Added ${data.length} new slot${data.length !== 1 ? 's' : ''} from ${startDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ` +
        `to ${endDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}\n` +
        `Days: ${selectedDayNames}\n` +
        `Time: ${formatTimeTo12Hour(bulkStartTime)} - ${formatTimeTo12Hour(bulkEndTime)}` +
        (skippedCount > 0 ? `\n\n(Skipped ${skippedCount} duplicate slot${skippedCount !== 1 ? 's' : ''})` : '')

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

      console.log(`Fetched ${data?.length || 0} available slots for giver ${giverId}`)
      return data || []
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

  // Create a booking
  const createBooking = async () => {
    if (!user || !selectedGiver || !selectedBookingDate || !selectedBookingTime) return

    setBookingLoading(true)
    setBookingError('')

    try {
      const scheduledTime = getScheduledTime(selectedBookingDate, selectedBookingTime)

      // Multi-listing price calculation (Phase 4)
      const basePrice = selectedListingForBooking
        ? selectedListingForBooking.price_cents / 100
        : selectedGiver.rate_per_30
      const totalPrice = basePrice * blocksBooked
      const durationMinutes = blocksBooked * TOTAL_BLOCK_MINUTES
      const amountCents = Math.round(basePrice * 100)
      const totalAmountCents = Math.round(totalPrice * 100)
      const platformFeeCents = Math.floor(totalAmountCents * 0.15)
      const giverPayoutCents = totalAmountCents - platformFeeCents

      // Create booking record with multi-listing data
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          seeker_id: user.id,
          giver_id: selectedGiver.id,
          listing_id: selectedListingForBooking?.id || null,
          scheduled_time: scheduledTime,
          duration_minutes: durationMinutes,
          blocks_booked: blocksBooked,
          amount_cents: amountCents,
          total_amount_cents: totalAmountCents,
          platform_fee_cents: platformFeeCents,
          giver_payout_cents: giverPayoutCents,
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
    if (!currentBooking || !user || !userProfile) return

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
          amount_cents: currentBooking.total_amount_cents,
          booking_id: currentBooking.id,
          type: 'booking',
          seeker_email: user.email,
        })
      })

      if (!paymentIntentResponse.ok) {
        const errorData = await paymentIntentResponse.json()
        throw new Error(errorData.error || 'Failed to create payment intent')
      }

      const { client_secret: _clientSecret, payment_intent_id } = await paymentIntentResponse.json()

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

      // Step 3: Create Daily.co room for the video session
      let videoRoomUrl: string | null = null
      try {
        videoRoomUrl = await createDailyRoom()
      } catch (roomError) {
        console.error('Failed to create video room:', roomError)
        // Continue without room - can be created later
      }

      // Step 4: Update booking to confirmed with video room URL
      // Note: Webhook will also update with payment_intent_id
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          stripe_payment_intent_id: payment_intent_id,
          video_room_url: videoRoomUrl,
        })
        .eq('id', currentBooking.id)

      if (error) throw error

      // Send confirmation notification
      sendNotification('booking_confirmed', currentBooking.id)

      // Update local booking state
      setCurrentBooking({
        ...currentBooking,
        status: 'confirmed',
        stripe_payment_intent_id: payment_intent_id,
        video_room_url: videoRoomUrl,
      })

      // Clear card inputs
      setCardNumber('')
      setCardExpiry('')
      setCardCvc('')

      // Go to confirmation
      setScreen('confirmation')
    } catch (err) {
      console.error('Payment error:', err)
      setBookingError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setBookingLoading(false)
    }
  }

  // Process extension payment and add time (Phase 6 + Phase 7)
  const processExtensionPayment = async () => {
    if (!activeSession || !user) return

    try {
      // Calculate extension amount (use booking's amount_cents as listing price)
      const extensionPriceCents = activeSession.amount_cents || 0
      const platformFeeCents = Math.floor(extensionPriceCents * 0.15)
      const totalAmountCents = extensionPriceCents + platformFeeCents

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
  }

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

  // Fetch givers from database with their listings
  const fetchGivers = useCallback(async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_giver', true)

      if (profilesError) throw profilesError

      if (profilesData && profilesData.length > 0) {
        // Fetch active listings for all givers
        const giverIds = profilesData.map(p => p.id)
        const { data: listingsData, error: listingsError } = await supabase
          .from('listings')
          .select('*')
          .in('user_id', giverIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (listingsError) throw listingsError

        // Fetch categories for listings
        if (listingsData && listingsData.length > 0) {
          const listingIds = listingsData.map(l => l.id)
          const { data: categoriesData } = await supabase
            .from('listing_categories')
            .select('listing_id, category')
            .in('listing_id', listingIds)

          // Merge categories into listings
          const listingsWithCategories = listingsData.map(listing => ({
            ...listing,
            categories: categoriesData
              ?.filter(c => c.listing_id === listing.id)
              .map(c => c.category as Category) || []
          }))

          // Attach listings to each giver
          const giversWithListings = profilesData.map(giver => ({
            ...giver,
            listings: listingsWithCategories.filter(l => l.user_id === giver.id)
          }))

          setGivers([...giversWithListings, ...demoGivers])
        } else {
          // No listings yet, just use profiles
          setGivers([...profilesData.map(g => ({ ...g, listings: [] })), ...demoGivers])
        }
      }
    } catch (err) {
      console.error('Error fetching givers:', err)
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

  // Check for shareable giver link on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const giverId = params.get('giver')
    if (giverId) {
      // Fetch this giver and show their profile
      supabase
        .from('profiles')
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

  // Auto-refresh sessions and confirmation pages
  useEffect(() => {
    if (screen === 'sessions' || screen === 'confirmation') {
      const interval = setInterval(() => {
        fetchUserBookings()
      }, 10000) // Check every 10 seconds to update join button availability
      return () => clearInterval(interval)
    }
  }, [screen, fetchUserBookings])

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
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        // Profile might not exist yet - that's OK
        console.log('user_profiles fetch:', error.message)
        setUserProfile(null)
        return
      }
      setUserProfile(data)
    } catch (err) {
      console.log('user_profiles error:', err)
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
      // Fetch listings
      const { data: listingsData, error: listingsError } = await supabase
        .from('listings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (listingsError) throw listingsError

      // Fetch categories for each listing
      if (listingsData && listingsData.length > 0) {
        const listingIds = listingsData.map(l => l.id)
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('listing_categories')
          .select('listing_id, category')
          .in('listing_id', listingIds)

        if (categoriesError) throw categoriesError

        // Merge categories into listings
        const listingsWithCategories = listingsData.map(listing => ({
          ...listing,
          categories: categoriesData
            ?.filter(c => c.listing_id === listing.id)
            .map(c => c.category as Category) || []
        }))

        setMyListings(listingsWithCategories)
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
  }) => {
    if (!user) return { success: false, error: 'Not authenticated' }

    try {
      // Insert listing
      const { data: newListing, error: listingError } = await supabase
        .from('listings')
        .insert({
          user_id: user.id,
          topic: listingData.topic,
          mode: listingData.mode,
          price_cents: listingData.price_cents,
          description: listingData.description,
          is_active: true
        })
        .select()
        .single()

      if (listingError) throw listingError

      // Insert categories
      if (listingData.categories.length > 0) {
        const categoryInserts = listingData.categories.map(category => ({
          listing_id: newListing.id,
          category
        }))

        const { error: categoriesError } = await supabase
          .from('listing_categories')
          .insert(categoryInserts)

        if (categoriesError) throw categoriesError
      }

      // Refresh listings
      await fetchMyListings()

      return { success: true, listing: newListing }
    } catch (err) {
      console.error('Error creating listing:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create listing' }
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
      const { topic, mode, price_cents, description, categories } = updates
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

      // Update categories if provided
      if (categories !== undefined) {
        // Delete existing categories
        const { error: deleteError } = await supabase
          .from('listing_categories')
          .delete()
          .eq('listing_id', listingId)

        if (deleteError) throw deleteError

        // Insert new categories
        if (categories.length > 0) {
          const categoryInserts = categories.map(category => ({
            listing_id: listingId,
            category
          }))

          const { error: insertError } = await supabase
            .from('listing_categories')
            .insert(categoryInserts)

          if (insertError) throw insertError
        }
      }

      // Refresh listings
      await fetchMyListings()

      return { success: true }
    } catch (err) {
      console.error('Error updating listing:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update listing' }
    }
  }

  // Deactivate a listing (soft delete)
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
    if (user && myGiverProfile && (screen === 'editVideo' || screen === 'userProfile')) {
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
      const joinTime = new Date()
      const scheduledTime = new Date(booking.scheduled_time)
      const lateMinutes = (joinTime.getTime() - scheduledTime.getTime()) / 1000 / 60

      // Automatic seeker credit if giver joins > 2 minutes late
      const updates: any = { giver_joined_at: joinTime.toISOString() }
      if (lateMinutes > 2) {
        updates.seeker_credit_earned = true

        // Increment giver's times_joined_late counter
        await supabase.rpc('increment_times_joined_late', {
          giver_user_id: booking.giver_id
        })
      }

      await supabase
        .from('bookings')
        .update(updates)
        .eq('id', booking.id)
    }

    setActiveSession(booking)

    // Time Physics (Phase 5): Active time = (blocks × 30) - 5 = blocks × 25 minutes
    const blocks = booking.blocks_booked || 1
    const activeMinutes = blocks * ACTIVE_MINUTES_PER_BLOCK
    setSessionTimeRemaining(activeMinutes * 60) // Convert to seconds

    setShowTimeWarning(false)
    setShowCountdown(false)

    // Reset extension state (Phase 6)
    setExtensionOffered(false)
    setShowExtensionUI(false)
    setMyExtensionResponse(null)
    setOtherPartyExtensionResponse(null)
    setExtensionTimeRemaining(60)
    setExtensionProcessing(false)

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

      // Track when participants leave (for both giver and seeker)
      call.on('participant-left', async (event) => {
        if (!user || !activeSession) return

        // Identify who left based on their session_id
        const localParticipant = call.participants().local
        const isLocalUserLeaving = event.participant.session_id === localParticipant?.session_id

        if (isLocalUserLeaving) {
          // Current user is leaving - track their leave time
          const leaveTime = new Date().toISOString()
          const isGiver = user.id === activeSession.giver_id

          // Update only if not already set (first leave time only)
          if (isGiver && !activeSession.giver_left_at) {
            await supabase
              .from('bookings')
              .update({ giver_left_at: leaveTime })
              .eq('id', activeSession.id)
              .is('giver_left_at', null)
          } else if (!isGiver && !activeSession.seeker_left_at) {
            await supabase
              .from('bookings')
              .update({ seeker_left_at: leaveTime })
              .eq('id', activeSession.id)
              .is('seeker_left_at', null)
          }
        }
      })

      await call.join({ url: activeSession.video_room_url })
    } catch (err) {
      console.error('Failed to join call:', err)
    }
  }, [activeSession, user])

  // Leave the video session
  const leaveSession = async (markComplete: boolean = false) => {
    // Destroy Daily call
    if (dailyCallRef.current) {
      await dailyCallRef.current.destroy()
      dailyCallRef.current = null
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

    // Reset extension state (Phase 6)
    setExtensionOffered(false)
    setShowExtensionUI(false)
    setMyExtensionResponse(null)
    setOtherPartyExtensionResponse(null)
    setExtensionTimeRemaining(60)
    setExtensionProcessing(false)

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
          // Time's up - hard cut (auto disconnect)
          clearInterval(timer)
          setShowCountdown(false)
          leaveSession(true)
          return 0
        }

        // Offer extension at 3 minutes (Phase 6: Extension System)
        // In production: Check if giver's next slot is available
        if (prev === 3 * 60 && !extensionOffered) {
          setExtensionOffered(true)
          setShowExtensionUI(true)
          setExtensionTimeRemaining(60)
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
  }, [activeSession, screen, leaveSession, playChime, showCountdown, extensionOffered])

  // Extension response timer (Phase 6: 60-second window)
  useEffect(() => {
    if (!showExtensionUI || !activeSession) return

    const timer = setInterval(() => {
      setExtensionTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - close extension UI (counts as "no")
          clearInterval(timer)
          setShowExtensionUI(false)
          if (myExtensionResponse === null) {
            setMyExtensionResponse('no')
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showExtensionUI, activeSession, myExtensionResponse])

  // Sync extension responses (Phase 6: Double-blind mechanic)
  useEffect(() => {
    if (!activeSession || !showExtensionUI) return
    if (myExtensionResponse === null) return

    // TODO: Production implementation - Use Supabase Realtime
    // 1. When myExtensionResponse is set, write to extensions table
    // 2. Subscribe to extensions table changes for this booking
    // 3. When other party responds, update otherPartyExtensionResponse
    //
    // Example Supabase integration:
    // const channel = supabase.channel(`extension:${activeSession.id}`)
    // channel.on('postgres_changes', {
    //   event: 'UPDATE',
    //   schema: 'public',
    //   table: 'extensions',
    //   filter: `booking_id=eq.${activeSession.id}`
    // }, (payload) => {
    //   const isGiver = activeSession.giver_id === user?.id
    //   const otherResponse = isGiver ? payload.new.seeker_confirmed : payload.new.giver_confirmed
    //   if (otherResponse !== null) {
    //     setOtherPartyExtensionResponse(otherResponse ? 'yes' : 'no')
    //   }
    // })
    // channel.subscribe()

    // PLACEHOLDER: Simulate other party response after 2-5 seconds (for testing)
    const delay = Math.random() * 3000 + 2000 // 2-5 seconds
    const timer = setTimeout(() => {
      // Random response for testing
      setOtherPartyExtensionResponse(Math.random() > 0.5 ? 'yes' : 'no')
    }, delay)

    return () => clearTimeout(timer)
  }, [myExtensionResponse, showExtensionUI, activeSession])

  // Handle extension outcome when both parties have responded (Phase 6)
  useEffect(() => {
    if (!activeSession || extensionProcessing) return
    if (myExtensionResponse === null || otherPartyExtensionResponse === null) return

    const handleExtensionOutcome = async () => {
      setExtensionProcessing(true)

      // Both parties have responded - check for match
      if (myExtensionResponse === 'yes' && otherPartyExtensionResponse === 'yes') {
        // MATCH! Process extension payment and add time
        console.log('Extension matched! Processing payment...')

        await processExtensionPayment()

        // Close extension UI
        setShowExtensionUI(false)

        // Reset for potential future extensions
        setTimeout(() => {
          setMyExtensionResponse(null)
          setOtherPartyExtensionResponse(null)
          setExtensionProcessing(false)
        }, 500)
      } else {
        // No match - at least one party declined
        console.log('Extension declined by one or both parties')

        // Close extension UI
        setShowExtensionUI(false)

        // Reset state
        setTimeout(() => {
          setMyExtensionResponse(null)
          setOtherPartyExtensionResponse(null)
          setExtensionProcessing(false)
        }, 500)
      }
    }

    handleExtensionOutcome()
  }, [myExtensionResponse, otherPartyExtensionResponse, activeSession, extensionProcessing])

  // Start Daily call when entering video session
  useEffect(() => {
    if (screen === 'videoSession' && activeSession) {
      startDailyCall()
    }
  }, [screen, activeSession, startDailyCall])

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
      // Check if user already has a giver profile
      const { data: existing } = await supabase
        .from('profiles')
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
          rate_per_30: giverRate,
          is_giver: true,
          available: true,
          qualities_offered: giverQualities,
          timezone: giverTimezone,
          twitter_handle: twitterHandle.trim() || null,
          instagram_handle: instagramHandle.trim() || null,
          linkedin_handle: linkedinHandle.trim() || null,
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      // Also create/update user_profiles table for timezone info
      const { error: userProfileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          timezone: giverTimezone,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })

      if (userProfileError) {
        console.warn('Failed to update user_profiles:', userProfileError)
        // Don't throw - this is not critical
      }

      // Refresh givers list and user's giver profile
      await fetchGivers()
      await fetchMyGiverProfile()

      // Go to payout setup (Stripe Connect)
      setScreen('payoutSetup')

      // Reset form
      setGiverName('')
      setGiverTagline('')
      setGiverRate(15)
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
        ...(myGiverProfile ? [] : [{ id: 'giverIntro', icon: '🌱', label: 'Offer' }]),
        { id: 'sessions', icon: '📅', label: 'Sessions' },
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

          {/* MYCA Logo */}
          <img
            src="/myca-logo.webp"
            alt="Myca"
            style={{
              width: '180px',
              height: 'auto',
              marginBottom: '30px'
            }}
          />

          <p style={{ fontSize: '1.05rem', color: colors.textPrimary, maxWidth: '340px', lineHeight: 1.5, marginBottom: '50px' }}>
            People with a gift for presence. Prepared, grounded, and committed to the craft of being there.
          </p>
          <div style={{ width: '100%', maxWidth: '320px' }}>
            <button style={btnStyle} onClick={() => setScreen('browse')}>Find Presence</button>
            <button
              style={btnSecondaryStyle}
              onClick={() => {
                // If user already has a giver profile, go to manage listings
                // Otherwise, start the onboarding flow
                if (myGiverProfile) {
                  setScreen('manageListings')
                } else {
                  setScreen('giverIntro')
                }
              }}
            >
              Offer Presence
            </button>
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
          {user && <Nav />}
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
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '5px', fontFamily: 'Georgia, serif' }}>
                    {giver.name}
                    {(giver.twitter_handle || giver.instagram_handle || giver.linkedin_handle) && (
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '0.9rem',
                        color: colors.accent,
                        fontWeight: 500
                      }}>
                        ✓
                      </span>
                    )}
                  </h3>
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
              {giver.bio && (
                <p style={{
                  fontSize: '0.85rem',
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                  marginBottom: '15px'
                }}>
                  {giver.bio.length > 100 ? `${giver.bio.slice(0, 100)}...` : giver.bio}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '15px', borderTop: `1px solid ${colors.border}` }}>
                {/* Multi-listing display */}
                {giver.listings && giver.listings.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                      {giver.listings.length} {giver.listings.length === 1 ? 'offering' : 'offerings'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                      ${Math.min(...giver.listings.map(l => l.price_cents / 100))} - ${Math.max(...giver.listings.map(l => l.price_cents / 100))} / 30 min
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>${giver.rate_per_30} <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: '0.9rem' }}>/ 30 min</span></div>
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
          <h1 style={{ fontSize: '2rem', fontFamily: 'Georgia, serif', textAlign: 'center', marginBottom: '10px' }}>
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
                  borderRadius: '16px',
                  background: '#000'
                }}
              />
            </div>
          )}

          {/* Qualities */}
          {selectedGiver.qualities_offered && selectedGiver.qualities_offered.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {selectedGiver.qualities_offered.map((quality, i) => (
                  <span
                    key={quality}
                    style={{
                      padding: '8px 16px',
                      background: i < 3 ? colors.accentSoft : colors.bgCard,
                      border: `1px solid ${i < 3 ? colors.accent : colors.border}`,
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      color: i < 3 ? colors.accent : colors.textSecondary,
                      fontWeight: i < 3 ? 600 : 400
                    }}
                  >
                    {quality}
                  </span>
                ))}
              </div>
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
              <h3 style={{ fontSize: '1.3rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Offerings</h3>
              {selectedGiver.listings.map(listing => {
                const modeInfo = MODES.find(m => m.value === listing.mode)
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
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>
                          {listing.topic}
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: colors.accent, marginBottom: '8px' }}>
                          {modeInfo?.label || listing.mode}
                        </p>
                        {modeInfo && (
                          <p style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '8px' }}>
                            {modeInfo.description}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '15px' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 600, color: colors.textPrimary }}>
                          ${(listing.price_cents / 100).toFixed(0)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                          per 30 min
                        </div>
                      </div>
                    </div>

                    {listing.description && (
                      <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>
                        {listing.description}
                      </p>
                    )}

                    {listing.categories && listing.categories.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                  </div>
                )
              })}
            </div>
          )}

          {/* Accountability Stats */}
          {(selectedGiver.total_sessions_completed || 0) > 0 && (
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                {selectedGiver.total_sessions_completed} session{selectedGiver.total_sessions_completed === 1 ? '' : 's'} completed
              </p>
              {(selectedGiver.times_joined_late || 0) > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '4px' }}>
                  Joined late {selectedGiver.times_joined_late} time{selectedGiver.times_joined_late === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}

          {/* Rate */}
          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: colors.textSecondary }}>30-minute session</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.accent }}>
                ${selectedGiver.rate_per_30}
              </span>
            </div>
          </div>

          {/* Available slots */}
          {selectedGiverSlots.length > 0 ? (
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>
                Available Times
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {selectedGiverSlots.slice(0, 10).map(slot => (
                  <div
                    key={slot.id}
                    style={{
                      padding: '8px 12px',
                      background: colors.bgSecondary,
                      borderRadius: '8px',
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

          {/* Book button */}
          <button
            style={{ ...btnStyle, width: '100%' }}
            onClick={() => {
              if (!user) {
                setScreen('welcome')
                alert('Please sign in to book a session')
              } else {
                setScreen('profile')
              }
            }}
          >
            Book Session with {selectedGiver.name}
          </button>

          <button
            style={{ ...btnSecondaryStyle, width: '100%', marginTop: '10px' }}
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
                borderRadius: '8px',
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

    // Multi-listing price calculation (Phase 4)
    const basePrice = selectedListingForBooking
      ? selectedListingForBooking.price_cents / 100
      : selectedGiver.rate_per_30
    const totalPrice = basePrice * blocksBooked
    const activeMinutes = blocksBooked * ACTIVE_MINUTES_PER_BLOCK
    const totalAmountCents = Math.round(totalPrice * 100)
    const platformFeeCents = Math.floor(totalAmountCents * 0.15)
    const giverPayoutCents = totalAmountCents - platformFeeCents

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
              {/* Show listing count or fallback to single rate */}
              {selectedGiver.listings && selectedGiver.listings.length > 0 ? (
                <div style={{ fontSize: '1.1rem', color: colors.accent }}>
                  {selectedGiver.listings.length} {selectedGiver.listings.length === 1 ? 'offering' : 'offerings'} available
                </div>
              ) : (
                <div style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.accent }}>${selectedGiver.rate_per_30} <span style={{ fontWeight: 400, color: colors.textSecondary, fontSize: '1rem' }}>/ 30 min</span></div>
              )}
            </div>
          </div>

          {/* Qualities */}
          {selectedGiver.qualities_offered && selectedGiver.qualities_offered.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                {selectedGiver.qualities_offered.map((quality, i) => (
                  <span
                    key={quality}
                    style={{
                      padding: '8px 16px',
                      background: i < 3 ? colors.accentSoft : colors.bgCard,
                      border: `1px solid ${i < 3 ? colors.accent : colors.border}`,
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      color: i < 3 ? colors.accent : colors.textSecondary,
                      fontWeight: i < 3 ? 600 : 400
                    }}
                  >
                    {quality}
                  </span>
                ))}
              </div>
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
              <h3 style={{ fontSize: '1.3rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Offerings</h3>
              {selectedGiver.listings.map(listing => {
                const modeInfo = MODES.find(m => m.value === listing.mode)
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
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>
                          {listing.topic}
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: colors.accent, marginBottom: '8px' }}>
                          {modeInfo?.label || listing.mode}
                        </p>
                        {modeInfo && (
                          <p style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '8px' }}>
                            {modeInfo.description}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', marginLeft: '15px' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 600, color: colors.textPrimary }}>
                          ${(listing.price_cents / 100).toFixed(0)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                          per 30 min
                        </div>
                      </div>
                    </div>

                    {listing.description && (
                      <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>
                        {listing.description}
                      </p>
                    )}

                    {listing.categories && listing.categories.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                  </div>
                )
              })}
            </div>
          )}

          {/* Accountability Stats */}
          {(selectedGiver.total_sessions_completed || 0) > 0 && (
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: colors.textMuted }}>
                {selectedGiver.total_sessions_completed} session{selectedGiver.total_sessions_completed === 1 ? '' : 's'} completed
              </p>
              {(selectedGiver.times_joined_late || 0) > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '4px' }}>
                  Joined late {selectedGiver.times_joined_late} time{selectedGiver.times_joined_late === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}

          <div style={{ ...cardStyle, cursor: 'default' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', fontFamily: 'Georgia, serif' }}>Book a Session</h3>

            {/* Listing Selection (Multi-listing architecture) */}
            {selectedGiver.listings && selectedGiver.listings.length > 0 && (
              <>
                <p style={{ color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
                  Select an offering
                </p>
                <div style={{ marginBottom: '20px' }}>
                  {selectedGiver.listings.map(listing => {
                    const modeInfo = MODES.find(m => m.value === listing.mode)
                    const isSelected = selectedListingForBooking?.id === listing.id
                    return (
                      <div
                        key={listing.id}
                        onClick={() => setSelectedListingForBooking(listing)}
                        style={{
                          padding: '15px',
                          marginBottom: '10px',
                          background: isSelected ? colors.accentSoft : colors.bgSecondary,
                          border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                          borderRadius: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>
                              {listing.topic}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: colors.accent }}>
                              {modeInfo?.label || listing.mode}
                            </div>
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: isSelected ? colors.accent : colors.textPrimary }}>
                            ${(listing.price_cents / 100).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Block Selection (Multi-block booking) */}
            <p style={{ color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Select duration
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
              {([1, 2, 3] as const).map(blocks => {
                const activeMinutes = blocks * ACTIVE_MINUTES_PER_BLOCK
                const isSelected = blocksBooked === blocks
                return (
                  <div
                    key={blocks}
                    onClick={() => setBlocksBooked(blocks)}
                    style={{
                      padding: '15px 10px',
                      background: isSelected ? colors.accentSoft : colors.bgSecondary,
                      border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                      borderRadius: '12px',
                      textAlign: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: isSelected ? colors.accent : colors.textPrimary,
                      marginBottom: '4px'
                    }}>
                      {activeMinutes} min
                    </div>
                    <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                      {blocks} block{blocks > 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>

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
                          minWidth: '80px',
                          padding: '15px 12px',
                          background: selectedBookingDate?.toISOString().split('T')[0] === dateStr
                            ? colors.accentSoft : colors.bgSecondary,
                          border: `1px solid ${selectedBookingDate?.toISOString().split('T')[0] === dateStr
                            ? colors.accent : colors.border}`,
                          borderRadius: '12px',
                          textAlign: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: selectedBookingDate?.toISOString().split('T')[0] === dateStr
                            ? colors.accent : colors.textPrimary
                        }}>
                          {formatDate(date)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '4px' }}>
                          {slots.length} slot{slots.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedBookingDate && selectedDateSlots.length > 0 && (
                  <>
                    <p style={{ color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
                      Select a time ({selectedGiver?.timezone ? getTimezoneAbbr(selectedGiver.timezone) : 'ET'})
                    </p>
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
                          {formatTimeTo12Hour(t)}
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

                {/* Price Summary */}
                <div style={{ padding: '20px 0', borderTop: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: colors.textSecondary }}>Duration</span>
                    <span style={{ fontWeight: 600 }}>{activeMinutes} minutes active</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: colors.textSecondary }}>Price per block</span>
                    <span>${basePrice.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: colors.textSecondary }}>Blocks</span>
                    <span>× {blocksBooked}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: `1px solid ${colors.border}`,
                    marginTop: '8px'
                  }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 600, color: colors.accent }}>${totalPrice.toFixed(2)}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '8px', textAlign: 'right' }}>
                    Giver receives ${(giverPayoutCents / 100).toFixed(2)} (85%)
                  </p>
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

            {/* Cancellation Policy Notice */}
            <div style={{
              padding: '15px',
              background: 'rgba(201, 166, 107, 0.1)',
              border: `1px solid ${colors.accent}`,
              borderRadius: '12px',
              marginBottom: '20px',
            }}>
              <p style={{ fontSize: '0.85rem', color: colors.textPrimary, marginBottom: '8px', fontWeight: 600 }}>
                Cancellation Policy
              </p>
              <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
                If you cancel: Your payment goes to the giver. No refund.
              </p>
              <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
                If giver cancels: You receive a full refund.
              </p>
              <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5, marginTop: '8px' }}>
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
          <p style={{ fontSize: '0.8rem', color: colors.textMuted, marginBottom: '20px', maxWidth: '300px' }}>
            Remember: If you cancel, your payment goes to {selectedGiver?.name}. If they cancel, you'll be refunded.
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

          <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif', marginBottom: '30px' }}>
            You have something to offer.
          </h2>

          <p style={{ fontSize: '1.05rem', color: colors.textSecondary, maxWidth: '380px', lineHeight: 1.7, marginBottom: '60px' }}>
            Maybe it's expertise you've earned. Maybe it's the ability to stay steady when someone needs to be heard. Maybe it's the gift of honest challenge. Maybe it's all of these at different moments.
            <br /><br />
            <span style={{ color: colors.textPrimary, fontWeight: 500 }}>MYCA is where you set the terms.</span>
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
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>What This Is</h2>
            <div style={{ width: '40px' }} />
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px' }}>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0' }}>
              You're about to define what kinds of attention you're willing to give—and what that's worth.
            </p>
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px' }}>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '15px' }}>
              Some people will book you to listen. Some will book you to strategize. Some will book you to teach, or to challenge, or just to talk. You decide which you offer, in what categories, at what price.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0' }}>
              Every session has a contract. They know what they're getting. You know what you're giving. The system handles the rest—timing, payment, endings.
            </p>
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '25px', background: `linear-gradient(135deg, rgba(201, 166, 107, 0.05), ${colors.bgCard})` }}>
            <h3 style={{ fontSize: '1.1rem', color: colors.textPrimary, marginBottom: '15px', fontWeight: 600 }}>
              What Makes This Work
            </h3>
            <ul style={{ color: colors.textSecondary, lineHeight: 1.8, marginLeft: '20px', marginBottom: '0' }}>
              <li>You show up fully for the time you've agreed to.</li>
              <li>You stay inside the contract. If they booked listening, you listen. If they booked strategy, you strategize. The mode is the promise.</li>
              <li>You let the system be the boundary. You don't negotiate time. You don't chase payment. You don't owe anything beyond the session.</li>
              <li>You release it when it ends. You gave your attention. That was the gift. Now it's done.</li>
            </ul>
          </div>

          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1.1rem', color: colors.textPrimary, marginBottom: '15px', fontWeight: 600 }}>
              Why People Do This
            </h3>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '15px', fontStyle: 'italic' }}>
              "Some want to monetize expertise they already have. Some want to be useful in ways their job doesn't allow. Some want to learn what it's like inside other people's lives. Some want structure around something they've been doing for free.
            </p>
            <p style={{ color: colors.textSecondary, lineHeight: 1.7, marginBottom: '0', fontStyle: 'italic' }}>
              Whatever your reason, that's the right one."
            </p>
          </div>

          {!user ? (
            <Auth onBack={() => setScreen('giverIntro')} />
          ) : (
            <button style={btnStyle} onClick={() => setScreen('give')}>Create Your First Listing</button>
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
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Video & Availability</h2>
            <div style={{ width: '40px' }} />
          </div>

          {/* Video Section */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Your Introduction Video
            </label>

            {myGiverProfile.video_url && !recordedUrl && videoStep === 'done' && (
              <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '20px', marginBottom: '15px' }}>
                <video
                  src={myGiverProfile.video_url}
                  controls
                  style={{ width: '100%', maxHeight: '400px', borderRadius: '12px', marginBottom: '15px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={async () => {
                      if (confirm('Delete your current video? You can record a new one.')) {
                        await supabase.from('givers').update({ video_url: null }).eq('user_id', user.id)
                        setMyGiverProfile({ ...myGiverProfile, video_url: null })
                      }
                    }}
                    style={{ ...btnSecondaryStyle, flex: 1, background: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)', color: '#f87171' }}
                  >
                    Delete Video
                  </button>
                  <button
                    onClick={() => setVideoStep('prompt')}
                    style={{ ...btnStyle, flex: 1 }}
                  >
                    Record New Video
                  </button>
                </div>
              </div>
            )}

            {(!myGiverProfile.video_url || videoStep !== 'done') && (
              <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '20px' }}>
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
                            await supabase.from('givers').update({ video_url: url }).eq('user_id', user.id)
                            setMyGiverProfile({ ...myGiverProfile, video_url: url })
                            setVideoStep('done')
                            setRecordedUrl(null)
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

            <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '20px' }}>
              {/* Bulk Add */}
              <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: `2px solid ${colors.border}` }}>
                <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>Quick Add</h4>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Date</label>
                    <input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>End Date</label>
                    <input type="date" value={bulkEndDate} min={bulkStartDate} onChange={(e) => setBulkEndDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Time</label>
                    <select value={bulkStartTime} onChange={(e) => setBulkStartTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem' }}>
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
                    <select value={bulkEndTime} onChange={(e) => setBulkEndTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem' }}>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <div key={index} onClick={() => toggleBulkDay(index)} style={{ padding: '10px 4px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, background: bulkSelectedDays.has(index) ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.has(index) ? colors.bgPrimary : colors.textSecondary, border: `1px solid ${bulkSelectedDays.has(index) ? colors.accent : colors.border}` }}>
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={addBulkAvailabilitySlots} disabled={bulkSelectedDays.size === 0} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: bulkSelectedDays.size > 0 ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.size > 0 ? colors.bgPrimary : colors.textMuted, cursor: bulkSelectedDays.size > 0 ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: 600 }}>
                  Add Availability
                </button>
              </div>

              {/* Current slots list */}
              {availabilitySlots.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>Your Slots ({availabilitySlots.length})</h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {availabilitySlots.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((slot) => (
                      <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: colors.bgSecondary, borderRadius: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
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
            <p style={{ fontSize: '0.85rem', color: colors.textPrimary, marginBottom: '8px', fontWeight: 600 }}>
              Your Commitment
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              When someone books your time, they pay upfront.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If you cancel: They get refunded. You receive nothing.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If they cancel: You keep their payment.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5, marginTop: '8px' }}>
              Only offer times you can reliably keep.
            </p>
          </div>

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

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>Your timezone *</label>
            <select
              value={giverTimezone}
              onChange={(e) => setGiverTimezone(e.target.value)}
              style={{
                width: '100%',
                padding: '15px',
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                color: colors.textPrimary,
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p style={{ color: colors.textMuted, fontSize: '0.8rem', marginTop: '8px' }}>
              Your availability times will be stored in this timezone
            </p>
          </div>

          {/* Bio/Background */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Bio/background <span style={{ color: colors.textMuted }}>(optional, 500 char max)</span>
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
                padding: '15px',
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                color: colors.textPrimary,
                fontSize: '1rem',
                boxSizing: 'border-box',
                minHeight: '100px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              placeholder="Share a bit about your background and experience..."
            />
            <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: '5px', textAlign: 'right' }}>
              {giverBio.length}/500
            </p>
          </div>

          {/* Social Verification */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Social Verification <span style={{ color: colors.textMuted }}>(optional)</span>
            </label>
            <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '15px', lineHeight: 1.6 }}>
              Link your social profiles to build trust. You'll receive a "Verified ✓" badge when at least one is added.
            </p>

            {/* Twitter */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '6px', fontSize: '0.85rem' }}>
                Twitter / X
              </label>
              <input
                type="text"
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                placeholder="@username"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '0.95rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Instagram */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '6px', fontSize: '0.85rem' }}>
                Instagram
              </label>
              <input
                type="text"
                value={instagramHandle}
                onChange={(e) => setInstagramHandle(e.target.value)}
                placeholder="@username"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '0.95rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* LinkedIn */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '6px', fontSize: '0.85rem' }}>
                LinkedIn
              </label>
              <input
                type="text"
                value={linkedinHandle}
                onChange={(e) => setLinkedinHandle(e.target.value)}
                placeholder="linkedin.com/in/yourprofile"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '0.95rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Qualities Offered */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Qualities you offer <span style={{ color: colors.textMuted }}>(select up to 5)</span>
            </label>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {QUALITIES.map(quality => {
                const isSelected = giverQualities.includes(quality)
                return (
                  <button
                    key={quality}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setGiverQualities(prev => prev.filter(q => q !== quality))
                      } else if (giverQualities.length < 5) {
                        setGiverQualities(prev => [...prev, quality])
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      background: isSelected ? colors.accent : colors.bgSecondary,
                      border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                      borderRadius: '20px',
                      color: isSelected ? colors.bgPrimary : colors.textPrimary,
                      cursor: giverQualities.length >= 5 && !isSelected ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 600 : 400,
                      opacity: giverQualities.length >= 5 && !isSelected ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    disabled={giverQualities.length >= 5 && !isSelected}
                  >
                    {quality}
                  </button>
                )
              })}
            </div>
            {giverQualities.length > 0 && (
              <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: '8px' }}>
                Selected: {giverQualities.join(', ')}
              </p>
            )}
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

          {/* Availability Section - Calendar Based */}
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '10px', fontSize: '0.9rem' }}>
              Availability * <span style={{ color: colors.textMuted }}>({getTotalSlots()} slots)</span>
            </label>

            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '16px',
              padding: '20px'
            }}>
              {/* Bulk Add Section */}
              <div style={{
                marginBottom: '25px',
                paddingBottom: '20px',
                borderBottom: `2px solid ${colors.border}`
              }}>
                <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>
                  Bulk Add Availability
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
                        borderRadius: '8px',
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
                        borderRadius: '8px',
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
                        borderRadius: '8px',
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
                        borderRadius: '8px',
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
                          borderRadius: '8px',
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
                    borderRadius: '8px',
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
                    borderRadius: '8px',
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
                    borderRadius: '8px',
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
                    borderRadius: '8px',
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
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}
                      >
                        <span style={{ color: colors.textPrimary }}>
                          {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTimeWithTz(slot.time, myGiverProfile?.timezone || 'America/New_York')}
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
            <p style={{ fontSize: '0.85rem', color: colors.textPrimary, marginBottom: '8px', fontWeight: 600 }}>
              Your Commitment
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              When someone books your time, they pay upfront.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If you cancel: They get refunded. You receive nothing.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5 }}>
              If they cancel: You keep their payment.
            </p>
            <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: 1.5, marginTop: '8px' }}>
              Only offer times you can reliably keep.
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
        {/* Giver opening protocol overlay */}
        {showGiverOverlay && user && activeSession && user.id === activeSession.giver_id && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 200,
            background: 'rgba(26, 26, 26, 0.95)',
            padding: '40px 60px',
            borderRadius: '16px',
            border: `1px solid ${colors.border}`,
            animation: 'fadeIn 0.5s ease-in',
          }}>
            <p style={{
              fontSize: '1.5rem',
              color: colors.textPrimary,
              textAlign: 'center',
              lineHeight: 1.6,
              margin: 0,
            }}>
              This is their time.<br />You are here with them.
            </p>
          </div>
        )}

        {/* 30-second countdown overlay (Phase 5: Time Physics) */}
        {showCountdown && _sessionTimeRemaining <= 30 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 250,
            background: 'rgba(220, 38, 38, 0.95)',
            padding: '60px 80px',
            borderRadius: '16px',
            border: '2px solid rgba(239, 68, 68, 0.8)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '5rem',
              fontWeight: 700,
              color: '#fff',
              marginBottom: '10px',
              fontFamily: 'monospace',
            }}>
              {_sessionTimeRemaining}
            </div>
            <div style={{
              fontSize: '1.2rem',
              color: 'rgba(255, 255, 255, 0.9)',
              textTransform: 'uppercase',
              letterSpacing: '2px',
            }}>
              Session Ending
            </div>
          </div>
        )}

        {/* Extension UI overlay (Phase 6: Double-blind extension system) */}
        {showExtensionUI && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 225,
            background: 'rgba(26, 26, 26, 0.97)',
            padding: '50px 70px',
            borderRadius: '16px',
            border: `2px solid ${colors.accent}`,
            textAlign: 'center',
            maxWidth: '500px',
          }}>
            {/* Double-blind indicator */}
            <div style={{
              fontSize: '0.75rem',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '1.5px',
              marginBottom: '20px',
            }}>
              Extension Offered • Double-Blind
            </div>

            {/* Extension offer */}
            <div style={{
              fontSize: '1.8rem',
              fontWeight: 600,
              color: colors.textPrimary,
              marginBottom: '15px',
              lineHeight: 1.3,
            }}>
              Extend session by 30 minutes?
            </div>

            {/* Price display */}
            <div style={{
              fontSize: '1.1rem',
              color: colors.accent,
              marginBottom: '25px',
            }}>
              ${((activeSession?.amount_cents || 0) / 100).toFixed(2)} + platform fee
            </div>

            {/* Response status or buttons */}
            {myExtensionResponse === null ? (
              <div>
                <div style={{
                  fontSize: '0.9rem',
                  color: colors.textSecondary,
                  marginBottom: '20px',
                  lineHeight: 1.5,
                }}>
                  Both parties must agree. Your response is private<br />
                  until both have answered.
                </div>

                <div style={{
                  display: 'flex',
                  gap: '15px',
                  justifyContent: 'center',
                  marginBottom: '20px',
                }}>
                  <button
                    onClick={() => setMyExtensionResponse('yes')}
                    style={{
                      flex: 1,
                      padding: '16px 30px',
                      background: colors.success,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setMyExtensionResponse('no')}
                    style={{
                      flex: 1,
                      padding: '16px 30px',
                      background: 'rgba(201, 107, 107, 0.9)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    No
                  </button>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '20px',
                background: colors.bgSecondary,
                borderRadius: '10px',
                marginBottom: '20px',
              }}>
                <div style={{
                  fontSize: '1rem',
                  color: colors.textPrimary,
                  marginBottom: '8px',
                }}>
                  Your response: <span style={{ fontWeight: 600, color: myExtensionResponse === 'yes' ? colors.success : 'rgba(201, 107, 107, 1)' }}>
                    {myExtensionResponse === 'yes' ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  color: colors.textSecondary,
                }}>
                  Waiting for other party...
                </div>
              </div>
            )}

            {/* Countdown timer */}
            <div style={{
              fontSize: '0.8rem',
              color: colors.textMuted,
              fontFamily: 'monospace',
            }}>
              {extensionTimeRemaining}s remaining
            </div>
          </div>
        )}

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

  // Feedback screen (Phase 8)
  if (screen === 'feedback') {
    return (
      <div style={containerStyle}>
        <div style={screenStyle}>
          <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif', textAlign: 'center', marginBottom: '15px' }}>
            Session Feedback
          </h2>

          <p style={{
            textAlign: 'center',
            color: colors.textSecondary,
            marginBottom: '40px',
            fontSize: '0.9rem',
            lineHeight: 1.6,
          }}>
            Your feedback helps improve the MYCA experience.<br />
            Responses are binary signals only—no text reviews.
          </p>

          {/* Question 1: Would book again */}
          <div style={{ marginBottom: '35px' }}>
            <h3 style={{
              fontSize: '1.1rem',
              marginBottom: '20px',
              color: colors.textPrimary,
            }}>
              Would you book this giver again?
            </h3>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                onClick={() => setWouldBookAgain(true)}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: wouldBookAgain === true ? colors.success : colors.bgSecondary,
                  color: wouldBookAgain === true ? '#fff' : colors.textPrimary,
                  border: wouldBookAgain === true ? `2px solid ${colors.success}` : `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  fontSize: '1rem',
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
                  padding: '16px',
                  background: wouldBookAgain === false ? 'rgba(201, 107, 107, 0.9)' : colors.bgSecondary,
                  color: wouldBookAgain === false ? '#fff' : colors.textPrimary,
                  border: wouldBookAgain === false ? '2px solid rgba(201, 107, 107, 0.9)' : `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: wouldBookAgain === false ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                No
              </button>
            </div>
          </div>

          {/* Question 2: Matched mode */}
          <div style={{ marginBottom: '40px' }}>
            <h3 style={{
              fontSize: '1.1rem',
              marginBottom: '20px',
              color: colors.textPrimary,
            }}>
              Did the session match the advertised mode?
            </h3>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button
                onClick={() => setMatchedMode(true)}
                style={{
                  flex: 1,
                  padding: '16px',
                  background: matchedMode === true ? colors.success : colors.bgSecondary,
                  color: matchedMode === true ? '#fff' : colors.textPrimary,
                  border: matchedMode === true ? `2px solid ${colors.success}` : `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  fontSize: '1rem',
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
                  padding: '16px',
                  background: matchedMode === false ? 'rgba(201, 107, 107, 0.9)' : colors.bgSecondary,
                  color: matchedMode === false ? '#fff' : colors.textPrimary,
                  border: matchedMode === false ? '2px solid rgba(201, 107, 107, 0.9)' : `1px solid ${colors.border}`,
                  borderRadius: '10px',
                  fontSize: '1rem',
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
            {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
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
              marginTop: '10px',
            }}
          >
            Skip for now
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
                          {userProfile && ` (${getTimezoneAbbr(userProfile.timezone)})`}
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
                        <p style={{ fontSize: '0.75rem', color: colors.textMuted, marginTop: '10px', marginBottom: '5px' }}>
                          {booking.giver_id === user?.id
                            ? 'Cancelling forfeits your payment for this session.'
                            : 'Cancelling means the giver keeps your payment.'}
                        </p>
                        <button
                          onClick={async () => {
                            const isGiver = booking.giver_id === user?.id

                          // Different consequences based on who cancels
                          const message = isGiver
                            ? 'Cancel this session? The seeker will receive a full refund. You will not be paid.'
                            : 'Cancel this session? Your payment will still go to the giver. No refund.'

                          if (confirm(message)) {
                            const { error } = await supabase
                              .from('bookings')
                              .update({
                                status: 'cancelled',
                                cancelled_by: isGiver ? 'giver' : 'seeker',
                                cancelled_at: new Date().toISOString(),
                                // Track refund status for when Stripe is real
                                refund_to_seeker: isGiver ? true : false
                              })
                              .eq('id', booking.id)

                            if (!error) {
                              // Send cancellation notification
                              sendNotification('cancellation', booking.id)

                              fetchUserBookings()
                              if (isGiver) {
                                alert('Session cancelled. The seeker will be refunded.')
                              } else {
                                alert('Session cancelled. Your payment has been forfeited to the giver.')
                              }
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '10px',
                          border: `1px solid rgba(220,38,38,0.3)`,
                          background: 'rgba(220,38,38,0.1)',
                          color: '#f87171',
                          cursor: 'pointer',
                          marginTop: '10px',
                          fontSize: '0.9rem',
                        }}
                      >
                        Cancel Session
                      </button>
                      </>
                    )}

                    {/* Feedback status for completed sessions (Phase 8) */}
                    {booking.status === 'completed' && !isGiver && (
                      <div style={{
                        marginTop: '15px',
                        padding: '12px',
                        background: colors.bgSecondary,
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        color: colors.textSecondary,
                      }}>
                        <div style={{ marginBottom: '8px', fontWeight: 500, color: colors.textPrimary }}>
                          📊 Session Feedback
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
                            padding: '10px',
                            background: colors.accent,
                            color: colors.bgPrimary,
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
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

              <button
                style={{ ...btnSecondaryStyle, marginTop: '20px' }}
                onClick={() => setScreen(myGiverProfile ? 'editGiverProfile' : 'browse')}
              >
                {myGiverProfile ? 'Manage Availability' : 'Book Another Session'}
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
              <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>Please sign in to view your profile</p>
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

          <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif', textAlign: 'center', marginBottom: '30px' }}>
            {myGiverProfile ? 'Profile & Settings' : 'Profile Settings'}
          </h2>

          {/* Account Info */}
          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Account</h3>
            <div style={{ marginBottom: '12px' }}>
              <p style={{ color: colors.textSecondary, fontSize: '0.85rem', marginBottom: '5px' }}>Email</p>
              <p style={{ color: colors.textPrimary }}>{user.email}</p>
            </div>
          </div>

          {/* Timezone Setting */}
          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Timezone</h3>
            <select
              value={currentTimezone}
              onChange={async (e) => {
                const newTimezone = e.target.value
                try {
                  // Update user_profiles table
                  const { error: profileError } = await supabase
                    .from('user_profiles')
                    .upsert({
                      id: user.id,
                      timezone: newTimezone,
                      updated_at: new Date().toISOString()
                    }, { onConflict: 'id' })

                  if (profileError) throw profileError

                  // If giver, also update profiles table
                  if (myGiverProfile) {
                    const { error: giverError } = await supabase
                      .from('profiles')
                      .update({ timezone: newTimezone })
                      .eq('id', user.id)

                    if (giverError) throw giverError
                  }

                  // Refresh data
                  await fetchUserProfile()
                  if (myGiverProfile) await fetchMyGiverProfile()

                  alert('Timezone updated successfully!')
                } catch (err) {
                  console.error('Error updating timezone:', err)
                  alert('Failed to update timezone. Please try again.')
                }
              }}
              style={{
                width: '100%',
                padding: '15px',
                background: colors.bgSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                color: colors.textPrimary,
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: '10px' }}>
              Times will be displayed in your timezone
            </p>
          </div>

          {/* Giver Profile Section - Full Editor */}
          {myGiverProfile ? (
            <>
              {/* Name & Tagline */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Public Profile</h3>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>Name</label>
                  <input
                    value={giverName}
                    onChange={(e) => setGiverName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>Tagline</label>
                  <input
                    value={giverTagline}
                    onChange={(e) => setGiverTagline(e.target.value)}
                    placeholder="Optional tagline"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                    Bio/background <span style={{ color: colors.textMuted }}>(optional, 500 char max)</span>
                  </label>
                  <textarea
                    value={giverBio}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) {
                        setGiverBio(e.target.value)
                      }
                    }}
                    placeholder="Share a bit about your background and experience..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      minHeight: '80px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                  <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: '5px', textAlign: 'right' }}>
                    {giverBio.length}/500
                  </p>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                    Qualities you offer <span style={{ color: colors.textMuted }}>(select up to 5)</span>
                  </label>
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}>
                    {QUALITIES.map(quality => {
                      const isSelected = giverQualities.includes(quality)
                      return (
                        <button
                          key={quality}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setGiverQualities(prev => prev.filter(q => q !== quality))
                            } else if (giverQualities.length < 5) {
                              setGiverQualities(prev => [...prev, quality])
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: isSelected ? colors.accent : colors.bgSecondary,
                            border: `1px solid ${isSelected ? colors.accent : colors.border}`,
                            borderRadius: '16px',
                            color: isSelected ? colors.bgPrimary : colors.textPrimary,
                            cursor: giverQualities.length >= 5 && !isSelected ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? 600 : 400,
                            opacity: giverQualities.length >= 5 && !isSelected ? 0.5 : 1,
                            transition: 'all 0.2s'
                          }}
                          disabled={giverQualities.length >= 5 && !isSelected}
                        >
                          {quality}
                        </button>
                      )
                    })}
                  </div>
                  {giverQualities.length > 0 && (
                    <p style={{ color: colors.textMuted, fontSize: '0.75rem', marginTop: '8px' }}>
                      Selected: {giverQualities.join(', ')}
                    </p>
                  )}
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
                      alert('Profile updated successfully!')
                    } catch (err) {
                      console.error('Error updating profile:', err)
                      alert('Failed to update profile. Please try again.')
                    }
                  }}
                  style={{
                    ...btnStyle,
                    margin: 0,
                    width: '100%'
                  }}
                >
                  Save Profile
                </button>
              </div>

              {/* Rate */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Rate</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                  <span style={{ color: colors.textPrimary, fontSize: '1.2rem' }}>$</span>
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
                      padding: '12px',
                      background: colors.bgSecondary,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ color: colors.textSecondary, fontSize: '0.9rem' }}>/ 30 min</span>
                </div>
                <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginBottom: '15px' }}>Minimum $15</p>
                <button
                  onClick={async () => {
                    if (giverRate < 15) {
                      alert('Minimum rate is $15 per 30 minutes')
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
                      alert('Rate updated successfully!')
                    } catch (err) {
                      console.error('Error updating rate:', err)
                      alert('Failed to update rate. Please try again.')
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

              {/* Update Video */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>Update Video</h3>
                <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '15px' }}>
                  Record or update your introduction video
                </p>
                <button
                  style={{ ...btnStyle, margin: 0, width: '100%' }}
                  onClick={() => setScreen('editVideo')}
                >
                  Update Video
                </button>
              </div>

              {/* Manage Availability */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>Manage Availability</h3>
                <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '15px' }}>
                  Add, remove, and manage your available time slots
                </p>
                <button
                  style={{ ...btnStyle, margin: 0, width: '100%' }}
                  onClick={() => setScreen('manageAvailability')}
                >
                  Manage Availability
                </button>
              </div>

              {/* Manage Listings */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>My Listings</h3>
                <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '15px' }}>
                  Create and manage your offerings ({myListings.filter(l => l.is_active).length} active)
                </p>
                <button
                  style={{ ...btnStyle, margin: 0, width: '100%' }}
                  onClick={() => setScreen('manageListings')}
                >
                  Manage Listings
                </button>
              </div>

              {/* Share Profile */}
              <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>Share Your Profile</h3>
                <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '15px' }}>
                  Copy your unique profile link to share with potential seekers
                </p>
                <button
                  style={{ ...btnStyle, margin: 0, width: '100%' }}
                  onClick={() => {
                    const shareUrl = `${window.location.origin}?giver=${user.id}`
                    navigator.clipboard.writeText(shareUrl)
                    alert('Link copied to clipboard!')
                  }}
                >
                  Copy Share Link
                </button>
              </div>

              {/* Current Video Preview */}
              {myGiverProfile?.video_url && (
                <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>Your Intro Video</h3>
                  <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
                    <video src={myGiverProfile.video_url} controls playsInline style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover' }} />
                  </div>
                </div>
              )}

              {/* Upcoming Availability */}
              {myGiverProfile && availabilitySlots.length > 0 && (
                <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '15px', fontFamily: 'Georgia, serif' }}>
                    Your Upcoming Availability ({availabilitySlots.length} slots)
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
                      <div key={date} style={{ marginBottom: '15px' }}>
                        <div style={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: colors.accent,
                          marginBottom: '8px'
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
                                borderRadius: '6px',
                                fontSize: '0.8rem',
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
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', fontFamily: 'Georgia, serif' }}>Become a Giver</h3>
              <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: '15px' }}>
                Share your presence with those who need it
              </p>
              <button
                style={{ ...btnStyle, margin: 0, width: '100%' }}
                onClick={() => setScreen('giverIntro')}
              >
                Offer Presence
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
              <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>Please sign in to manage listings</p>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button onClick={() => setScreen('userProfile')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>My Listings</h2>
            <div style={{ width: '40px' }} />
          </div>

          {listingsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: colors.textSecondary }}>Loading listings...</p>
            </div>
          ) : (
            <>
              {/* Create New Listing Button */}
              <button
                style={{
                  ...btnStyle,
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onClick={() => {
                  // Reset form
                  setListingFormData({
                    topic: '',
                    mode: 'mirror',
                    price_cents: 2500,
                    description: '',
                    selectedCategories: []
                  })
                  setSelectedListing(null)
                  setScreen('createListing')
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>+</span>
                Create New Listing
              </button>

              {/* Listings List */}
              {myListings.length === 0 ? (
                <div style={{ ...cardStyle, cursor: 'default', textAlign: 'center' }}>
                  <p style={{ color: colors.textSecondary, marginBottom: '15px' }}>
                    You haven't created any listings yet
                  </p>
                  <p style={{ color: colors.textMuted, fontSize: '0.9rem' }}>
                    Create a listing to start offering your presence
                  </p>
                </div>
              ) : (
                <>
                  {myListings.map(listing => {
                    const modeInfo = MODES.find(m => m.value === listing.mode)
                    return (
                      <div
                        key={listing.id}
                        style={{
                          ...cardStyle,
                          opacity: listing.is_active ? 1 : 0.6,
                          borderLeft: listing.is_active ? `3px solid ${colors.accent}` : `3px solid ${colors.border}`
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>
                              {listing.topic}
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: colors.accent, marginBottom: '8px' }}>
                              {modeInfo?.label || listing.mode}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 600, color: colors.textPrimary }}>
                              ${(listing.price_cents / 100).toFixed(0)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: colors.textMuted }}>
                              per 30 min
                            </div>
                          </div>
                        </div>

                        {listing.description && (
                          <p style={{ fontSize: '0.9rem', color: colors.textSecondary, marginBottom: '12px' }}>
                            {listing.description}
                          </p>
                        )}

                        {listing.categories && listing.categories.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
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
                                    color: colors.textSecondary,
                                    marginRight: '6px'
                                  }}
                                >
                                  {catInfo?.label || cat}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                          <button
                            style={{
                              flex: 1,
                              padding: '10px',
                              background: colors.bgSecondary,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '8px',
                              color: colors.textPrimary,
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                            onClick={() => {
                              setSelectedListing(listing)
                              setListingFormData({
                                topic: listing.topic,
                                mode: listing.mode,
                                price_cents: listing.price_cents,
                                description: listing.description || '',
                                selectedCategories: listing.categories || []
                              })
                              setScreen('editListing')
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={{
                              flex: 1,
                              padding: '10px',
                              background: listing.is_active ? colors.bgSecondary : colors.accentSoft,
                              border: `1px solid ${listing.is_active ? colors.border : colors.accent}`,
                              borderRadius: '8px',
                              color: listing.is_active ? colors.textSecondary : colors.accent,
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                            onClick={async () => {
                              if (listing.is_active) {
                                if (confirm('Deactivate this listing? It will no longer be visible to seekers.')) {
                                  const result = await deactivateListing(listing.id)
                                  if (!result.success) {
                                    alert(result.error || 'Failed to deactivate listing')
                                  }
                                }
                              } else {
                                const result = await reactivateListing(listing.id)
                                if (!result.success) {
                                  alert(result.error || 'Failed to reactivate listing')
                                }
                              }
                            }}
                          >
                            {listing.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>

                        {!listing.is_active && (
                          <div style={{
                            marginTop: '12px',
                            padding: '8px 12px',
                            background: 'rgba(255, 200, 100, 0.1)',
                            border: '1px solid rgba(255, 200, 100, 0.3)',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            color: 'rgb(255, 200, 100)'
                          }}>
                            Inactive - not visible to seekers
                          </div>
                        )}
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
              <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>Please sign in to create a listing</p>
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button onClick={() => setScreen('manageListings')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Create Listing</h2>
            <div style={{ width: '40px' }} />
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault()

              // Validation
              if (listingFormData.price_cents < 1500) {
                alert('Minimum price is $15 per 30 minutes')
                return
              }

              const result = await createListing({
                topic: listingFormData.topic.trim(),
                mode: listingFormData.mode,
                price_cents: listingFormData.price_cents,
                description: listingFormData.description.trim(),
                categories: listingFormData.selectedCategories
              })

              if (result.success) {
                setScreen('manageListings')
              } else {
                alert(result.error || 'Failed to create listing')
              }
            }}
          >
            {/* Specific Topics (optional) */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Specific Topics (optional)
              </label>
              <input
                type="text"
                value={listingFormData.topic}
                onChange={(e) => setListingFormData({ ...listingFormData, topic: e.target.value })}
                placeholder="e.g., judo, website building, divorce recovery"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Mode */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '12px', fontSize: '0.9rem' }}>
                Mode of Attention <span style={{ color: colors.accent }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {MODES.map(mode => (
                  <label
                    key={mode.value}
                    style={{
                      padding: '12px',
                      background: listingFormData.mode === mode.value ? colors.accentSoft : colors.bgSecondary,
                      border: `1px solid ${listingFormData.mode === mode.value ? colors.accent : colors.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'start',
                      gap: '10px'
                    }}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={mode.value}
                      checked={listingFormData.mode === mode.value}
                      onChange={(e) => setListingFormData({ ...listingFormData, mode: e.target.value as Mode })}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: colors.textPrimary, marginBottom: '4px' }}>
                        {mode.label}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                        {mode.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Price */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Price per 30 minutes <span style={{ color: colors.accent }}>*</span>
              </label>
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
                    borderRadius: '8px',
                    color: colors.textPrimary,
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
              <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: '8px' }}>
                Minimum: $15 • You'll receive 85% (${((listingFormData.price_cents / 100) * 0.85).toFixed(2)}) after platform fee
              </p>
            </div>

            {/* Categories */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '12px', fontSize: '0.9rem' }}>
                Categories (select up to 3)
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
                        borderRadius: '20px',
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

            {/* Description */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Description (optional)
              </label>
              <textarea
                value={listingFormData.description}
                onChange={(e) => setListingFormData({ ...listingFormData, description: e.target.value })}
                placeholder="Add more detail about this specific offering..."
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
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
              Create Listing
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
              <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>Listing not found</p>
              <button style={btnStyle} onClick={() => setScreen('manageListings')}>Back to Listings</button>
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
            <h2 style={{ fontSize: '1.5rem', fontFamily: 'Georgia, serif' }}>Edit Listing</h2>
            <div style={{ width: '40px' }} />
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault()

              // Validation
              if (listingFormData.price_cents < 1500) {
                alert('Minimum price is $15 per 30 minutes')
                return
              }

              const result = await updateListing(selectedListing.id, {
                topic: listingFormData.topic.trim(),
                mode: listingFormData.mode,
                price_cents: listingFormData.price_cents,
                description: listingFormData.description.trim(),
                categories: listingFormData.selectedCategories
              })

              if (result.success) {
                setScreen('manageListings')
              } else {
                alert(result.error || 'Failed to update listing')
              }
            }}
          >
            {/* Specific Topics (optional) */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Specific Topics (optional)
              </label>
              <input
                type="text"
                value={listingFormData.topic}
                onChange={(e) => setListingFormData({ ...listingFormData, topic: e.target.value })}
                placeholder="e.g., judo, website building, divorce recovery"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textPrimary,
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Mode */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '12px', fontSize: '0.9rem' }}>
                Mode of Attention <span style={{ color: colors.accent }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {MODES.map(mode => (
                  <label
                    key={mode.value}
                    style={{
                      padding: '12px',
                      background: listingFormData.mode === mode.value ? colors.accentSoft : colors.bgSecondary,
                      border: `1px solid ${listingFormData.mode === mode.value ? colors.accent : colors.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'start',
                      gap: '10px'
                    }}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={mode.value}
                      checked={listingFormData.mode === mode.value}
                      onChange={(e) => setListingFormData({ ...listingFormData, mode: e.target.value as Mode })}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, color: colors.textPrimary, marginBottom: '4px' }}>
                        {mode.label}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>
                        {mode.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Price */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Price per 30 minutes <span style={{ color: colors.accent }}>*</span>
              </label>
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
                    borderRadius: '8px',
                    color: colors.textPrimary,
                    fontSize: '1rem',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
              <p style={{ color: colors.textMuted, fontSize: '0.85rem', marginTop: '8px' }}>
                Minimum: $15 • You'll receive 85% (${((listingFormData.price_cents / 100) * 0.85).toFixed(2)}) after platform fee
              </p>
            </div>

            {/* Categories */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '12px', fontSize: '0.9rem' }}>
                Categories (select up to 3)
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
                        borderRadius: '20px',
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

            {/* Description */}
            <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
              <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '8px', fontSize: '0.9rem' }}>
                Description (optional)
              </label>
              <textarea
                value={listingFormData.description}
                onChange={(e) => setListingFormData({ ...listingFormData, description: e.target.value })}
                placeholder="Add more detail about this specific offering..."
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: colors.bgSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
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
