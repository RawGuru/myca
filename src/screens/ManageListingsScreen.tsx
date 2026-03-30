import React from 'react'
import { User } from '@supabase/supabase-js'

// Local type definitions (not imported from App.tsx to avoid circular dependency)
type Mode = 'vault' | 'mirror' | 'strategist' | 'teacher' | 'challenger' | 'vibe_check'
type Category = 'health' | 'relationships' | 'creativity' | 'career_money' | 'life_transitions' | 'spirituality' | 'general'

interface Listing {
  id: string
  user_id: string
  topic: string
  mode: Mode
  price_cents: number
  description: string | null
  specific_topics?: string | null
  is_active: boolean
  requires_approval?: boolean
  allow_instant_book?: boolean
  directions_allowed?: string[]
  boundaries?: string | null
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
    profile_picture_url?: string | null
    [key: string]: any
  }
}

interface ManageListingsScreenProps {
  // Auth/data
  user: User | null
  myListings: Listing[]
  listingsLoading: boolean
  modes: { value: string; label: string; description: string }[]

  // Navigation
  onNavigate: (screen: string) => void
  onCreateListing: () => void
  onEditListing: (listing: Listing) => void

  // Shared components
  Nav: React.ComponentType
  SignOutButton: React.ComponentType

  // Design tokens
  colors: {
    bgPrimary: string
    bgSecondary: string
    border: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    accent: string
    accentSoft: string
  }
  typography: {
    xs: string
    base: string
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

export default function ManageListingsScreen({
  user,
  myListings,
  listingsLoading,
  modes,
  onNavigate,
  onCreateListing,
  onEditListing,
  Nav,
  SignOutButton,
  colors,
  typography,
  spacing,
  containerStyle,
  screenStyle,
  btnStyle,
  cardStyle
}: ManageListingsScreenProps) {
  // Short labels for mode badges
  const shortLabels: Record<string, string> = {
    vault: 'Pure listening',
    mirror: 'Reflective listening',
    strategist: 'Problem-solving',
    teacher: 'Teaching',
    challenger: 'Direct challenge',
    vibe_check: 'Casual conversation'
  }

  if (!user) {
    return (
      <div style={containerStyle}>
        <div style={screenStyle}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: colors.textSecondary, marginBottom: spacing.lg }}>Please sign in to manage listings</p>
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
          <button onClick={() => onNavigate('userProfile')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
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
              onClick={onCreateListing}
            >
              <span style={{ fontSize: typography.lg }}>+</span>
              Create new room
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
              onClick={() => onNavigate('manageAvailability')}
            >
              Availability
            </button>

            {/* Offers List */}
            {myListings.length === 0 ? (
              <div style={{ ...cardStyle, cursor: 'default', textAlign: 'center' }}>
                <p style={{ color: colors.textSecondary, marginBottom: spacing.md }}>
                  No rooms yet
                </p>
                <p style={{ color: colors.textMuted, fontSize: typography.base }}>
                  Define your session style to get started.
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
                          {listing.topic && (
                            <h3 style={{ fontSize: typography.lg, marginBottom: '6px', fontWeight: 600 }}>
                              {listing.topic}
                            </h3>
                          )}
                          {/* Show mode badge with short labels */}
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            background: colors.accentSoft,
                            borderRadius: '3px',
                            fontSize: typography.xs,
                            color: colors.accent,
                            fontWeight: 500
                          }}>
                            {shortLabels[listing.mode] || modes.find(m => m.value === listing.mode)?.label || listing.mode?.replace('_', ' ') || 'General'}
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
                          onClick={() => onEditListing(listing)}
                        >
                          Edit room
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
