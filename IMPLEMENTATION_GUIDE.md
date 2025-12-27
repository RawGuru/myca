# MYCA Rebuild Implementation Guide
**Version:** 1.0 | **Date:** December 27, 2025

---

## What's Been Completed ✅

### Phase 1: Database Migration & Type System
- ✅ Created `listings` table for multi-listing architecture
- ✅ Created `listing_categories` table for discovery
- ✅ Created `extensions` table for session extensions
- ✅ Created `feedback` table for post-session ratings
- ✅ Updated `bookings` table with multi-block fields
- ✅ Migrated existing profile data to default listings
- ✅ Set up RLS policies for all new tables
- ✅ Created TypeScript interfaces (Listing, Extension, Feedback)
- ✅ Updated Booking interface for new architecture
- ✅ Added Mode and Category type definitions
- ✅ Added constants for MODES, CATEGORIES, and time physics

**Migration File:** `/supabase/migrations/20251227_multi_listing_architecture.sql`

---

## What Needs to Be Built 🚧

This is a complete architectural rebuild. The application currently uses the old single-listing model. Everything needs to be updated to use the new multi-listing system.

### Phase 2: Listing Management (CRITICAL - DO THIS FIRST)

#### 2.1: Add State Variables for Listings

In `App.tsx`, add after the giver profile state:

```typescript
// Listing management state
const [myListings, setMyListings] = useState<Listing[]>([])
const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
const [listingTopic, setListingTopic] = useState('')
const [listingMode, setListingMode] = useState<Mode>('mirror')
const [listingPrice, setListingPrice] = useState(1500) // cents, $15 minimum
const [listingDescription, setListingDescription] = useState('')
const [listingCategories, setListingCategories] = useState<Category[]>([])
```

#### 2.2: Create Listing CRUD Functions

```typescript
// Fetch user's listings
const fetchMyListings = useCallback(async () => {
  if (!user) return

  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_categories(category)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!error && data) {
    // Transform categories from array of objects to array of strings
    const listings = data.map(l => ({
      ...l,
      categories: l.listing_categories?.map(c => c.category) || []
    }))
    setMyListings(listings)
  }
}, [user])

// Create new listing
const createListing = async () => {
  if (!user) return
  if (!listingTopic.trim()) {
    alert('Please enter a topic')
    return
  }
  if (listingPrice < 1500) {
    alert('Minimum price is $15')
    return
  }
  if (listingCategories.length === 0) {
    alert('Please select at least one category')
    return
  }

  try {
    // Create listing
    const { data: listing, error } = await supabase
      .from('listings')
      .insert({
        user_id: user.id,
        topic: listingTopic,
        mode: listingMode,
        price_cents: listingPrice,
        description: listingDescription || null,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    // Add categories
    await supabase
      .from('listing_categories')
      .insert(
        listingCategories.map(cat => ({
          listing_id: listing.id,
          category: cat
        }))
      )

    // Refresh listings
    await fetchMyListings()

    // Reset form
    setListingTopic('')
    setListingMode('mirror')
    setListingPrice(1500)
    setListingDescription('')
    setListingCategories([])

    setScreen('manageListings')
  } catch (err) {
    console.error('Error creating listing:', err)
    alert('Failed to create listing')
  }
}

// Update listing
const updateListing = async (listingId: string) => {
  // Similar pattern to createListing
}

// Delete listing (set is_active = false)
const deactivateListing = async (listingId: string) => {
  const { error } = await supabase
    .from('listings')
    .update({ is_active: false })
    .eq('id', listingId)

  if (!error) {
    await fetchMyListings()
  }
}
```

#### 2.3: Create Listing Management UI

Add a new screen `manageListings`:

```typescript
if (screen === 'manageListings') {
  return (
    <div style={containerStyle}>
      <div style={{ ...screenStyle, paddingBottom: '100px' }}>
        <h2>Your Listings</h2>

        {/* List existing listings */}
        {myListings.map(listing => (
          <div key={listing.id} style={cardStyle}>
            <h3>{listing.topic}</h3>
            <p>{MODES.find(m => m.value === listing.mode)?.label}</p>
            <p>${(listing.price_cents / 100).toFixed(2)} / 30 min</p>
            <p>{listing.description}</p>
            <div>
              {listing.categories?.map(cat => (
                <span key={cat}>{CATEGORIES.find(c => c.value === cat)?.label}</span>
              ))}
            </div>
            <button onClick={() => deactivateListing(listing.id)}>Deactivate</button>
          </div>
        ))}

        {/* Button to create new listing */}
        <button onClick={() => setScreen('createListing')}>
          + Create New Listing
        </button>

        <Nav />
      </div>
    </div>
  )
}
```

#### 2.4: Create Listing Creation Form

Add a new screen `createListing` with form fields for:
- Topic (text input)
- Mode (select from MODES)
- Price (number input, minimum $15)
- Description (textarea)
- Categories (multi-select checkboxes from CATEGORIES, 1-3 required)

### Phase 3: Update Giver Profile Display

The giver profile needs to show as a "Menu" of listings instead of a single rate.

#### 3.1: Fetch Giver's Listings

When viewing a giver profile, fetch their listings:

```typescript
const [selectedGiverListings, setSelectedGiverListings] = useState<Listing[]>([])

const fetchGiverListings = async (userId: string) => {
  const { data, error } = await supabase
    .from('listings')
    .select('*, listing_categories(category)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('price_cents', { ascending: false })

  if (!error && data) {
    const listings = data.map(l => ({
      ...l,
      categories: l.listing_categories?.map(c => c.category) || []
    }))
    setSelectedGiverListings(listings)
  }
}
```

#### 3.2: Update Profile UI

In both `profile` and `publicGiverProfile` screens, replace the single rate display with a listing menu:

```typescript
{/* Giver's Menu */}
<h3>What I Offer</h3>
{selectedGiverListings.map(listing => (
  <div key={listing.id} style={cardStyle} onClick={() => {
    setSelectedListing(listing)
    setScreen('booking') // Navigate to booking flow
  }}>
    <h4>{listing.topic}</h4>
    <p>{MODES.find(m => m.value === listing.mode)?.label}</p>
    <p>{listing.description}</p>
    <div>
      {listing.categories?.map(cat => (
        <span key={cat}>{CATEGORIES.find(c => c.value === cat)?.label}</span>
      ))}
    </div>
    <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>
      ${(listing.price_cents / 100).toFixed(2)} / 30 min
    </p>
  </div>
))}
```

### Phase 4: Update Booking Flow

#### 4.1: Add Multi-Block Selection

The booking flow needs to allow selecting 1, 2, or 3 blocks:

```typescript
const [blocksToBook, setBlocksToBook] = useState(1)

// In booking screen:
<div>
  <h3>How many blocks?</h3>
  {[1, 2, 3].map(blocks => {
    const activeMinutes = (blocks * TOTAL_BLOCK_MINUTES) - BUFFER_MINUTES
    const totalCost = selectedListing.price_cents * blocks
    const platformFee = Math.floor(totalCost * 0.15)

    return (
      <button
        key={blocks}
        onClick={() => setBlocksToBook(blocks)}
        style={{
          background: blocksToBook === blocks ? colors.accent : colors.bgCard,
          ...
        }}
      >
        <div>{blocks} Block{blocks > 1 ? 's' : ''}</div>
        <div>{activeMinutes} minutes</div>
        <div>${(totalCost / 100).toFixed(2)}</div>
      </button>
    )
  })}
</div>
```

#### 4.2: Update Payment Calculation

```typescript
const calculateBookingCosts = (priceCents: number, blocks: number) => {
  const totalAmountCents = priceCents * blocks
  const platformFeeCents = Math.floor(totalAmountCents * 0.15)
  const giverPayoutCents = totalAmountCents - platformFeeCents

  return { totalAmountCents, platformFeeCents, giverPayoutCents }
}
```

#### 4.3: Update Booking Creation

```typescript
const createBooking = async () => {
  if (!user || !selectedListing || !selectedBookingDate || !selectedBookingTime) return

  const { totalAmountCents, platformFeeCents, giverPayoutCents } =
    calculateBookingCosts(selectedListing.price_cents, blocksToBook)

  const scheduledTime = new Date(`${selectedBookingDate}T${selectedBookingTime}:00`)

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      seeker_id: user.id,
      giver_id: selectedListing.user_id,
      listing_id: selectedListing.id,
      scheduled_time: scheduledTime.toISOString(),
      blocks_booked: blocksToBook,
      duration_minutes: 30 * blocksToBook,
      amount_cents: totalAmountCents, // Keep for backward compatibility
      total_amount_cents: totalAmountCents,
      platform_fee_cents: platformFeeCents,
      giver_payout_cents: giverPayoutCents,
      status: 'pending'
    })
    .select()
    .single()

  if (!error) {
    setCurrentBooking(booking)
    setScreen('payment')
  }
}
```

### Phase 5: Time Physics Implementation

This is critical for the session experience.

#### 5.1: Add Time Calculation Functions

```typescript
// Calculate when session ends based on blocks and extensions
const calculateSessionEndTime = (startTime: Date, blocksBooked: number, extensionsGranted: number): Date => {
  const totalBlocks = blocksBooked + extensionsGranted
  const totalActiveMinutes = (totalBlocks * TOTAL_BLOCK_MINUTES) - BUFFER_MINUTES
  return new Date(startTime.getTime() + totalActiveMinutes * 60 * 1000)
}

// Calculate warning time (5 min before end)
const calculateWarningTime = (sessionEndTime: Date): Date => {
  return new Date(sessionEndTime.getTime() - 5 * 60 * 1000)
}

// Calculate countdown start (30 sec before end)
const calculateCountdownStart = (sessionEndTime: Date): Date => {
  return new Date(sessionEndTime.getTime() - 30 * 1000)
}
```

#### 5.2: Update Session Timer

Replace the current timer logic with:

```typescript
const [sessionEndTime, setSessionEndTime] = useState<Date | null>(null)
const [timeRemaining, setTimeRemaining] = useState(0) // seconds
const [showWarning, setShowWarning] = useState(false)
const [showCountdown, setShowCountdown] = useState(false)

useEffect(() => {
  if (!activeSession) return

  // Calculate end time
  const startTime = new Date(activeSession.scheduled_time)
  const endTime = calculateSessionEndTime(
    startTime,
    activeSession.blocks_booked,
    activeSession.extended_count
  )
  setSessionEndTime(endTime)

  // Timer tick every second
  const interval = setInterval(() => {
    const now = new Date()
    const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000))
    setTimeRemaining(remaining)

    // Warning at 5 minutes
    if (remaining === 300 && !showWarning) {
      setShowWarning(true)
      playChime() // Play gentle audio chime
    }

    // Countdown at 30 seconds
    if (remaining === 30 && !showCountdown) {
      setShowCountdown(true)
    }

    // Hard cut at 0
    if (remaining === 0) {
      endSessionHardCut()
    }
  }, 1000)

  return () => clearInterval(interval)
}, [activeSession])
```

#### 5.3: Add Warning Chime

```typescript
const playChime = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // Gentle chime
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
  oscillator.type = 'sine'

  gainNode.gain.setValueAtTime(0, audioContext.currentTime)
  gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1.5)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 1.5)
}
```

#### 5.4: Add Countdown Overlay

In the video session screen:

```typescript
{showCountdown && timeRemaining > 0 && (
  <div style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '4rem',
    fontWeight: 'bold',
    color: colors.accent,
    textShadow: '0 0 20px rgba(0,0,0,0.8)',
    pointerEvents: 'none'
  }}>
    {timeRemaining}
  </div>
)}
```

#### 5.5: Hard Cut Implementation

```typescript
const endSessionHardCut = async () => {
  // Immediately destroy video call
  if (dailyCallRef.current) {
    await dailyCallRef.current.destroy()
    dailyCallRef.current = null
  }

  // Mark session as completed
  if (activeSession) {
    await supabase
      .from('bookings')
      .update({
        status: 'completed',
        session_ended_at: new Date().toISOString()
      })
      .eq('id', activeSession.id)

    // Increment giver's sessions completed
    await supabase.rpc('increment_sessions_completed', {
      giver_user_id: activeSession.giver_id
    })
  }

  // Navigate to feedback screen
  setActiveSession(null)
  setScreen('feedback')
}
```

### Phase 6: Extension System

#### 6.1: Check Extension Eligibility

```typescript
const canExtendSession = async (bookingId: string): Promise<boolean> => {
  const booking = await getBooking(bookingId)
  if (!booking) return false

  // Calculate when current session ends
  const startTime = new Date(booking.scheduled_time)
  const currentEndTime = calculateSessionEndTime(
    startTime,
    booking.blocks_booked,
    booking.extended_count
  )

  // Check if next 30-min slot is available
  const nextSlotStart = currentEndTime
  const nextSlotEnd = new Date(nextSlotStart.getTime() + TOTAL_BLOCK_MINUTES * 60 * 1000)

  const { data: conflictingBooking } = await supabase
    .from('bookings')
    .select('id')
    .eq('giver_id', booking.giver_id)
    .eq('status', 'confirmed')
    .gte('scheduled_time', nextSlotStart.toISOString())
    .lt('scheduled_time', nextSlotEnd.toISOString())
    .maybeSingle()

  return !conflictingBooking
}
```

#### 6.2: Extension UI (Double-Blind)

When warning chime plays, if extension is available:

```typescript
const [extensionOffered, setExtensionOffered] = useState(false)
const [extensionResponse, setExtensionResponse] = useState<boolean | null>(null)

// When warning triggers
if (remaining === 300) {
  const canExtend = await canExtendSession(activeSession.id)
  if (canExtend) {
    setExtensionOffered(true)
  }
}

// In video session UI
{extensionOffered && extensionResponse === null && (
  <div style={overlayStyle}>
    <p>{user.id === activeSession.giver_id ? 'Continue?' : `Extend for $${(selectedListing.price_cents / 100).toFixed(2)}?`}</p>
    <button onClick={() => handleExtensionResponse(true)}>Yes</button>
    <button onClick={() => handleExtensionResponse(false)}>No</button>
  </div>
)}
```

#### 6.3: Extension Response Handling

```typescript
const handleExtensionResponse = async (response: boolean) => {
  setExtensionResponse(response)

  // Submit to database
  const isGiver = user.id === activeSession.giver_id

  if (isGiver) {
    // Update extension record with giver response
    await supabase
      .from('extensions')
      .update({ giver_confirmed: response })
      .eq('booking_id', activeSession.id)
      .is('giver_confirmed', null)
  } else {
    // Update with seeker response
    await supabase
      .from('extensions')
      .update({ seeker_confirmed: response })
      .eq('booking_id', activeSession.id)
      .is('seeker_confirmed', null)
  }

  // Check if both responded
  const { data: extension } = await supabase
    .from('extensions')
    .select('*')
    .eq('booking_id', activeSession.id)
    .single()

  if (extension.giver_confirmed !== null && extension.seeker_confirmed !== null) {
    if (extension.giver_confirmed && extension.seeker_confirmed) {
      // MATCH! Extend the session
      await grantExtension()
    } else {
      // NO MATCH - hide UI, proceed to hard cut
      setExtensionOffered(false)
    }
  }
}

const grantExtension = async () => {
  // Charge seeker
  // ... Stripe payment logic ...

  // Update booking
  await supabase
    .from('bookings')
    .update({
      extended_count: activeSession.extended_count + 1,
      total_amount_cents: activeSession.total_amount_cents + selectedListing.price_cents
    })
    .eq('id', activeSession.id)

  // Recalculate end time (adds 30 minutes)
  const newEndTime = new Date(sessionEndTime.getTime() + TOTAL_BLOCK_MINUTES * 60 * 1000)
  setSessionEndTime(newEndTime)
  setShowWarning(false)
  setExtensionOffered(false)
  setExtensionResponse(null)

  // Play confirmation sound
  playChime()
}
```

### Phase 7: Real Stripe Integration

Currently using mock payments. Need to implement real Stripe.

#### 7.1: Stripe Connect for Givers

In giver onboarding, add Stripe Connect:

```typescript
const startStripeOnboarding = async () => {
  const response = await fetch('/api/stripe/connect/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id })
  })

  const { accountLinkUrl } = await response.json()
  window.location.href = accountLinkUrl
}
```

Backend endpoint (`/api/stripe/connect/onboard`):

```typescript
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export default async function handler(req, res) {
  const { userId } = req.body

  // Create Stripe Connect account
  const account = await stripe.accounts.create({
    type: 'standard',
    metadata: { userId }
  })

  // Create account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/stripe/refresh`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/stripe/complete`,
    type: 'account_onboarding',
  })

  // Save account ID to user profile
  await supabase
    .from('profiles')
    .update({ stripe_account_id: account.id })
    .eq('id', userId)

  res.json({ accountLinkUrl: accountLink.url })
}
```

#### 7.2: Payment Intent Creation

In booking flow, create real PaymentIntent:

```typescript
const createPaymentIntent = async () => {
  const response = await fetch('/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingId: currentBooking.id,
      amountCents: currentBooking.total_amount_cents,
      giverStripeAccountId: selectedGiver.stripe_account_id,
      platformFeeCents: currentBooking.platform_fee_cents
    })
  })

  const { clientSecret } = await response.json()
  return clientSecret
}
```

Backend endpoint:

```typescript
export default async function handler(req, res) {
  const { amountCents, giverStripeAccountId, platformFeeCents } = req.body

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    application_fee_amount: platformFeeCents,
    transfer_data: {
      destination: giverStripeAccountId,
    },
  })

  res.json({ clientSecret: paymentIntent.client_secret })
}
```

### Phase 8: Feedback System

After session ends, show feedback form:

```typescript
if (screen === 'feedback') {
  return (
    <div style={containerStyle}>
      <div style={screenStyle}>
        <h2>How was your session?</h2>

        <div style={cardStyle}>
          <p>Would you book again?</p>
          <button onClick={() => submitFeedback(true, null)}>Yes</button>
          <button onClick={() => submitFeedback(false, null)}>No</button>
        </div>

        <div style={cardStyle}>
          <p>Did they match their stated mode?</p>
          <button onClick={() => submitFeedback(null, true)}>Yes</button>
          <button onClick={() => submitFeedback(null, false)}>No</button>
        </div>
      </div>
    </div>
  )
}

const submitFeedback = async (wouldBookAgain: boolean | null, matchedMode: boolean | null) => {
  await supabase
    .from('feedback')
    .insert({
      booking_id: activeSession.id,
      seeker_id: user.id,
      giver_id: activeSession.giver_id,
      would_book_again: wouldBookAgain,
      matched_mode: matchedMode
    })

  setScreen('sessions')
}
```

---

## Testing Checklist

Before considering the rebuild complete:

- [ ] Can create multiple listings with different modes/prices
- [ ] Can view giver profile as "menu" of listings
- [ ] Can book 1, 2, or 3 blocks upfront
- [ ] Pricing calculations correct (85/15 split)
- [ ] Session ends after correct time (25 min for 1 block, 55 for 2, 85 for 3)
- [ ] Warning chime plays at 5 minutes before end
- [ ] Countdown appears at 30 seconds
- [ ] Hard cut terminates video at 0:00
- [ ] Extension offer appears if next slot available
- [ ] Extension charges seeker and adds 30 minutes
- [ ] Real Stripe payments work
- [ ] Stripe Connect onboarding works for givers
- [ ] Feedback collected after session
- [ ] Listings can be created/edited/deactivated

---

## Current State & Next Actions

**STATUS:** Foundation complete, UI implementation required

**WHAT WORKS:**
- Database schema is ready
- TypeScript types are defined
- Constants are in place
- Old features (Features 1-7) still functional with old schema

**WHAT DOESN'T WORK:**
- Application still uses old single-listing model
- No UI for listing management
- Booking flow doesn't support multi-block
- Session timer still uses old 30-minute flat logic
- No extension system
- Using mock Stripe payments

**RECOMMENDED APPROACH:**

1. **Start with Phase 2** - Get listing management working
2. **Then Phase 3** - Update giver profile display
3. **Then Phase 4** - Update booking flow
4. Build remaining phases in order

**ESTIMATED EFFORT:** 20-30 hours of focused development

This is a complete rebuild. Take it one phase at a time. Test thoroughly at each phase before moving to the next.
