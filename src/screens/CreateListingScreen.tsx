import React from 'react'
import { User } from '@supabase/supabase-js'

// Local type definitions (not imported from App.tsx to avoid circular dependency)
type Mode = 'vault' | 'mirror' | 'strategist' | 'teacher' | 'challenger' | 'vibe_check'
type Category = 'health' | 'relationships' | 'creativity' | 'career_money' | 'life_transitions' | 'spirituality' | 'general'

interface ListingFormData {
  topic: string
  mode: Mode
  price_cents: number
  description: string
  selectedCategories: Category[]
  requires_approval: boolean
  allow_instant_book: boolean
  directions_allowed: string[]
  boundaries: string
}

interface CreateListingScreenProps {
  // Auth/data
  user: User | null
  listingFormData: ListingFormData
  listingFormError: string | null

  // Callbacks
  onNavigate: (screen: string) => void
  onUpdateFormData: (updates: Partial<ListingFormData>) => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  onUploadPhoto: (publicUrl: string) => Promise<void>

  // Shared components
  Nav: React.ComponentType
  SignOutButton: React.ComponentType
  ImageUpload: React.ComponentType<{
    onUpload: (url: string) => Promise<void>
    currentImageUrl?: string
    bucketName: string
    maxSizeMB: number
    aspectRatio?: 'circle' | 'square' | 'wide'
    initials?: string
  }>

  // Constants
  blockMinutes: number

  // Design tokens
  colors: {
    bgPrimary: string
    bgSecondary: string
    bgCard: string
    border: string
    borderEmphasis: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    accent: string
    accentSoft: string
  }
  typography: {
    xs: string
    sm: string
    base: string
    md: string
    lg: string
    xl: string
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }

  // Style objects
  containerStyle: React.CSSProperties
  screenStyle: React.CSSProperties
  btnStyle: React.CSSProperties
  cardStyle: React.CSSProperties
}

export default function CreateListingScreen({
  user,
  listingFormData,
  listingFormError,
  onNavigate,
  onUpdateFormData,
  onSubmit,
  onUploadPhoto,
  Nav,
  SignOutButton,
  ImageUpload,
  blockMinutes,
  colors,
  typography,
  spacing,
  containerStyle,
  screenStyle,
  btnStyle,
  cardStyle
}: CreateListingScreenProps) {
  if (!user) {
    return (
      <div style={containerStyle}>
        <div style={screenStyle}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>Please sign in to create a room</p>
            <button style={btnStyle} onClick={() => onNavigate('welcome')}>Go to Home</button>
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
          <button onClick={() => onNavigate('manageListings')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
          <h2 style={{ fontSize: typography.xl, fontWeight: 600 }}>Define your session style</h2>
          <div style={{ width: '40px' }} />
        </div>

        <p style={{ fontSize: typography.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          This is how people will understand what kind of space you can hold.
        </p>

        <form onSubmit={onSubmit}>
          {/* Simplified: Giver offers themselves inside protocol, not expertise */}

          {/* Profile Photo */}
          <div style={{ marginBottom: spacing.lg }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: spacing.xs, fontSize: typography.base }}>
              Profile photo <span style={{ color: colors.textMuted, fontWeight: 400 }}>(optional)</span>
            </label>
            <ImageUpload
              onUpload={onUploadPhoto}
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
              onChange={(e) => onUpdateFormData({ topic: e.target.value })}
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
              onChange={(e) => onUpdateFormData({ description: e.target.value })}
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
              per 25-min session ({blockMinutes} minutes)
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
                  onUpdateFormData({ price_cents: Math.round(dollars * 100) })
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
                    onUpdateFormData({ directions_allowed: updated })
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
              onChange={(e) => onUpdateFormData({ boundaries: e.target.value })}
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
                onChange={(e) => onUpdateFormData({ allow_instant_book: e.target.checked })}
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
                    Cannot create room
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
