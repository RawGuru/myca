import React from 'react'
import { User } from '@supabase/supabase-js'

// Local type definitions (not imported from App.tsx to avoid circular dependency)
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
  rate_per_30?: number
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
  twitter_handle?: string | null
  instagram_handle?: string | null
  linkedin_handle?: string | null
  profile_picture_url?: string | null
}

interface ManageAvailabilityScreenProps {
  // Auth/data
  user: User | null
  myGiverProfile: Giver | null
  availabilitySlots: AvailabilitySlot[]

  // Bulk add state
  bulkStartDate: string
  bulkEndDate: string
  bulkStartTime: string
  bulkEndTime: string
  bulkSelectedDays: Set<number>

  // Callbacks
  onNavigate: (screen: string) => void
  onSetBulkStartDate: (date: string) => void
  onSetBulkEndDate: (date: string) => void
  onSetBulkStartTime: (time: string) => void
  onSetBulkEndTime: (time: string) => void
  onToggleBulkDay: (dayIndex: number) => void
  onAddBulkSlots: () => Promise<void>
  onRemoveSlot: (slotId: string) => Promise<void>
  onClearAllSlots: () => Promise<void>
  formatTimeTo12Hour: (time24: string) => string

  // Shared components
  Nav: React.ComponentType

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
    xxl: string
  }

  // Style objects
  containerStyle: React.CSSProperties
  screenStyle: React.CSSProperties
  btnStyle: React.CSSProperties
}

export default function ManageAvailabilityScreen({
  user,
  myGiverProfile,
  availabilitySlots,
  bulkStartDate,
  bulkEndDate,
  bulkStartTime,
  bulkEndTime,
  bulkSelectedDays,
  onNavigate,
  onSetBulkStartDate,
  onSetBulkEndDate,
  onSetBulkStartTime,
  onSetBulkEndTime,
  onToggleBulkDay,
  onAddBulkSlots,
  onRemoveSlot,
  onClearAllSlots,
  formatTimeTo12Hour,
  Nav,
  colors,
  typography,
  spacing,
  containerStyle,
  screenStyle,
  btnStyle
}: ManageAvailabilityScreenProps) {
  if (!user || !myGiverProfile) {
    return (
      <div style={containerStyle}>
        <div style={screenStyle}>
          <p style={{ color: colors.textSecondary }}>Please set up your giver profile first</p>
          <button style={btnStyle} onClick={() => onNavigate('giverIntro')}>Get Started</button>
          <Nav />
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xxl }}>
          <button onClick={() => onNavigate('manageListings')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
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
                  <input type="date" value={bulkStartDate} onChange={(e) => onSetBulkStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm, boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: typography.sm, color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>End Date</label>
                  <input type="date" value={bulkEndDate} min={bulkStartDate} onChange={(e) => onSetBulkEndDate(e.target.value)} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: typography.sm, color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Time</label>
                  <select value={bulkStartTime} onChange={(e) => onSetBulkStartTime(e.target.value)} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm }}>
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
                  <select value={bulkEndTime} onChange={(e) => onSetBulkEndTime(e.target.value)} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: typography.sm }}>
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
                    <div key={index} onClick={() => onToggleBulkDay(index)} style={{ padding: `${spacing.sm} 0`, borderRadius: '3px', textAlign: 'center', cursor: 'pointer', fontSize: typography.xs, fontWeight: 500, background: bulkSelectedDays.has(index) ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.has(index) ? colors.bgPrimary : colors.textSecondary, border: `1px solid ${bulkSelectedDays.has(index) ? colors.accent : colors.border}`, minWidth: 0 }}>
                      {day}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={onAddBulkSlots} disabled={bulkSelectedDays.size === 0} style={{ width: '100%', padding: spacing.sm, borderRadius: '3px', border: 'none', background: bulkSelectedDays.size > 0 ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.size > 0 ? colors.bgPrimary : colors.textMuted, cursor: bulkSelectedDays.size > 0 ? 'pointer' : 'not-allowed', fontSize: typography.base, fontWeight: 600 }}>
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
                                <button onClick={() => onRemoveSlot(slot.id)} style={{ padding: '4px 8px', borderRadius: '3px', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: typography.sm }}>✕</button>
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
                                    <button onClick={() => onRemoveSlot(slot.id)} style={{ padding: '4px 8px', borderRadius: '3px', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: typography.sm }}>✕</button>
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
          <button onClick={onClearAllSlots} style={{
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
