-- MYCA Multi-Listing Architecture Migration
-- This migrates from single-listing-per-user to multi-listing-per-user model

-- Step 1: Create listings table
CREATE TABLE IF NOT EXISTS listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('vault', 'mirror', 'strategist', 'teacher', 'challenger', 'vibe_check')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 1500),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create listing categories table
CREATE TABLE IF NOT EXISTS listing_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('health', 'relationships', 'creativity', 'career_money', 'life_transitions', 'spirituality', 'general')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, category)
);

-- Step 3: Update bookings table for multi-listing
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS listing_id UUID REFERENCES listings(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS blocks_booked INTEGER DEFAULT 1 CHECK (blocks_booked IN (1, 2, 3));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount_cents INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS giver_payout_cents INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seeker_joined_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_started_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS session_ended_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extended_count INTEGER DEFAULT 0;
ALTER TABLE bookings DROP COLUMN IF EXISTS refund_to_seeker;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_issued BOOLEAN DEFAULT FALSE;

-- Step 4: Create extensions table
CREATE TABLE IF NOT EXISTS extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  extended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  giver_confirmed BOOLEAN DEFAULT FALSE,
  seeker_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seeker_id UUID NOT NULL REFERENCES auth.users(id),
  giver_id UUID NOT NULL REFERENCES auth.users(id),
  would_book_again BOOLEAN,
  matched_mode BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, seeker_id)
);

-- Step 6: Migrate existing profile data to listings
-- For each existing giver profile, create a default listing
INSERT INTO listings (user_id, topic, mode, price_cents, description, is_active)
SELECT
  id as user_id,
  'General Session' as topic,
  'mirror' as mode,
  rate_per_30 * 100 as price_cents,
  tagline as description,
  available as is_active
FROM profiles
WHERE is_giver = TRUE
ON CONFLICT DO NOTHING;

-- Step 7: Update existing bookings to reference the new listings
UPDATE bookings b
SET listing_id = l.id,
    blocks_booked = 1,
    total_amount_cents = b.amount_cents,
    platform_fee_cents = FLOOR(b.amount_cents * 0.15),
    giver_payout_cents = b.amount_cents - FLOOR(b.amount_cents * 0.15)
FROM listings l
WHERE b.giver_id = l.user_id
AND b.listing_id IS NULL;

-- Step 8: Create indexes
CREATE INDEX IF NOT EXISTS idx_listings_user ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active);
CREATE INDEX IF NOT EXISTS idx_listing_categories_listing ON listing_categories(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_categories_category ON listing_categories(category);
CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_extensions_booking ON extensions(booking_id);
CREATE INDEX IF NOT EXISTS idx_feedback_booking ON feedback(booking_id);
CREATE INDEX IF NOT EXISTS idx_feedback_giver ON feedback(giver_id);

-- Step 9: RLS Policies for listings
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active listings"
  ON listings FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Users can view their own listings"
  ON listings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own listings"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);

-- Step 10: RLS Policies for listing_categories
ALTER TABLE listing_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listing categories"
  ON listing_categories FOR SELECT
  USING (true);

CREATE POLICY "Listing owners can manage categories"
  ON listing_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_categories.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Step 11: RLS Policies for extensions
ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking participants can view extensions"
  ON extensions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = extensions.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

CREATE POLICY "System can create extensions"
  ON extensions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Participants can update their confirmation"
  ON extensions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = extensions.booking_id
      AND (bookings.seeker_id = auth.uid() OR bookings.giver_id = auth.uid())
    )
  );

-- Step 12: RLS Policies for feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON feedback FOR SELECT
  USING (auth.uid() = seeker_id OR auth.uid() = giver_id);

CREATE POLICY "Seekers can create feedback for their bookings"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = seeker_id);

-- Step 13: Add comments
COMMENT ON TABLE listings IS 'Giver offerings - each user can have multiple listings at different prices and modes';
COMMENT ON TABLE listing_categories IS 'Categories for listing discovery - one listing can have multiple categories';
COMMENT ON TABLE extensions IS 'Session extensions requested during active calls';
COMMENT ON TABLE feedback IS 'Post-session feedback - binary signals only, no text reviews';
COMMENT ON COLUMN bookings.blocks_booked IS 'Number of 30-minute blocks booked upfront (1, 2, or 3)';
COMMENT ON COLUMN bookings.extended_count IS 'Number of times session was extended during call';
COMMENT ON COLUMN bookings.platform_fee_cents IS '15% platform fee';
COMMENT ON COLUMN bookings.giver_payout_cents IS '85% payout to giver';
