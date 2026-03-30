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
}

interface EditListingScreenProps {
  // Auth/data
  user: User | null
  selectedListing: Listing | null
  listingFormData: ListingFormData
  listingFormError: string | null

  // Callbacks
  onNavigate: (screen: string) => void
  onUpdateFormData: (updates: Partial<ListingFormData>) => void
  onSubmit: (e: React.FormEvent) => Promise<void>

  // Constants
  categories: { value: string; label: string; examples: string }[]
  blockMinutes: number

  // Shared components
  Nav: React.ComponentType
  SignOutButton: React.ComponentType

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

export default function EditListingScreen({
  user,
  selectedListing,
  listingFormData,
  listingFormError: _listingFormError,
  onNavigate,
  onUpdateFormData,
  onSubmit,
  categories,
  blockMinutes,
  Nav,
  SignOutButton,
  colors,
  typography: _typography,
  spacing: _spacing,
  containerStyle,
  screenStyle,
  btnStyle,
  cardStyle
}: EditListingScreenProps) {
  if (!user || !selectedListing) {
    return (
      <div style={containerStyle}>
        <div style={screenStyle}>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>Offer not found</p>
            <button style={btnStyle} onClick={() => onNavigate('manageListings')}>Back to Offers</button>
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
          <button onClick={() => onNavigate('manageListings')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Edit your session style</h2>
          <div style={{ width: '40px' }} />
        </div>

        <form onSubmit={onSubmit}>
          {/* STEP 2 - What category? */}
          <div style={{ ...cardStyle, cursor: 'default', marginBottom: '20px' }}>
            <label style={{ display: 'block', color: colors.textSecondary, marginBottom: '12px', fontSize: '0.9rem' }}>
              What category? <span style={{ color: colors.textMuted, fontWeight: 400 }}>(Select 1-3)</span>
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {categories.map(cat => {
                const isSelected = listingFormData.selectedCategories.includes(cat.value as Category)
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onUpdateFormData({
                          selectedCategories: listingFormData.selectedCategories.filter(c => c !== cat.value)
                        })
                      } else if (listingFormData.selectedCategories.length < 3) {
                        onUpdateFormData({
                          selectedCategories: [...listingFormData.selectedCategories, cat.value as Category]
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
              onChange={(e) => onUpdateFormData({ topic: e.target.value })}
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
              per 25-min session ({blockMinutes} minutes)
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
                  onUpdateFormData({ price_cents: Math.round(dollars * 100) })
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
              onChange={(e) => onUpdateFormData({ description: e.target.value })}
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
