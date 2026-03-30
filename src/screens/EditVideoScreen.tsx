import React from 'react'
import { User } from '@supabase/supabase-js'
import { SupabaseClient } from '@supabase/supabase-js'

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

type VideoStep = 'done' | 'prompt' | 'recording' | 'preview'

interface EditVideoScreenProps {
  // Auth/data
  user: User | null
  myGiverProfile: Giver | null

  // Video state
  videoStep: VideoStep
  recordedUrl: string | null
  recordingTime: number
  videoJustSaved: boolean
  previewVideoRef: React.RefObject<HTMLVideoElement>

  // Availability state
  availabilitySlots: AvailabilitySlot[]
  bulkStartDate: string
  bulkEndDate: string
  bulkStartTime: string
  bulkEndTime: string
  bulkSelectedDays: Set<number>

  // Video callbacks
  onNavigate: (screen: string) => void
  onSetVideoStep: (step: VideoStep) => void
  onSetVideoJustSaved: (saved: boolean) => void
  onSetMyGiverProfile: (profile: Giver) => void
  onSetRecordedUrl: (url: string | null) => void
  onSetProfileError: (error: string) => void
  onStartRecording: () => void
  onStopRecording: () => void
  onRetakeVideo: () => void
  onUploadVideo: () => Promise<string | null>

  // Availability callbacks
  onSetBulkStartDate: (date: string) => void
  onSetBulkEndDate: (date: string) => void
  onSetBulkStartTime: (time: string) => void
  onSetBulkEndTime: (time: string) => void
  onToggleBulkDay: (dayIndex: number) => void
  onAddBulkSlots: () => Promise<void>
  onRemoveSlot: (slotId: string) => Promise<void>
  onSetAvailabilitySlots: (slots: AvailabilitySlot[]) => void
  formatTimeTo12Hour: (time24: string) => string

  // Supabase client
  supabase: SupabaseClient

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

  // Style objects
  containerStyle: React.CSSProperties
  screenStyle: React.CSSProperties
  btnStyle: React.CSSProperties
  btnSecondaryStyle: React.CSSProperties
}

export default function EditVideoScreen({
  user,
  myGiverProfile,
  videoStep,
  recordedUrl,
  recordingTime,
  videoJustSaved,
  previewVideoRef,
  availabilitySlots,
  bulkStartDate,
  bulkEndDate,
  bulkStartTime,
  bulkEndTime,
  bulkSelectedDays,
  onNavigate,
  onSetVideoStep,
  onSetVideoJustSaved,
  onSetMyGiverProfile,
  onSetRecordedUrl,
  onSetProfileError,
  onStartRecording,
  onStopRecording,
  onRetakeVideo,
  onUploadVideo,
  onSetBulkStartDate,
  onSetBulkEndDate,
  onSetBulkStartTime,
  onSetBulkEndTime,
  onToggleBulkDay,
  onAddBulkSlots,
  onRemoveSlot,
  onSetAvailabilitySlots,
  formatTimeTo12Hour,
  supabase,
  Nav,
  colors,
  containerStyle,
  screenStyle,
  btnStyle,
  btnSecondaryStyle
}: EditVideoScreenProps) {
  if (!user || !myGiverProfile) {
    return (
      <div style={containerStyle}>
        <div style={screenStyle}>
          <p style={{ color: colors.textSecondary }}>Please set up your giver profile first.</p>
          <button style={btnStyle} onClick={() => onNavigate('giverIntro')}>Get Started</button>
          <Nav />
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={{ ...screenStyle, position: 'relative', paddingBottom: '100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
          <button onClick={() => onNavigate('userProfile')} style={{ width: '40px', height: '40px', borderRadius: '50%', background: colors.bgSecondary, border: `1px solid ${colors.border}`, color: colors.textPrimary, cursor: 'pointer' }}>←</button>
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
                      onSetMyGiverProfile({ ...myGiverProfile, video_url: null })
                      onSetVideoJustSaved(false)
                    }
                  }}
                  style={{ ...btnSecondaryStyle, flex: 1, background: 'rgba(220,38,38,0.1)', borderColor: 'rgba(220,38,38,0.3)', color: '#f87171' }}
                >
                  Delete Video
                </button>
                <button
                  onClick={() => {
                    onSetVideoStep('prompt')
                    onSetVideoJustSaved(false)
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
                <button onClick={() => onSetVideoStep('prompt')} style={{ width: '100%', ...btnStyle }}>
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
                    <button onClick={() => onSetVideoStep('done')} style={{ ...btnSecondaryStyle, flex: 1 }}>Cancel</button>
                    <button onClick={() => onStartRecording()} style={{ ...btnStyle, flex: 1 }}>Start Recording</button>
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
                  <button onClick={onStopRecording} style={{ width: '100%', ...btnStyle, background: '#dc2626' }}>Stop Recording</button>
                </div>
              )}

              {videoStep === 'preview' && recordedUrl && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <video src={recordedUrl} controls style={{ width: '100%', maxHeight: '400px', borderRadius: '12px' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={onRetakeVideo} style={{ ...btnSecondaryStyle, flex: 1 }}>Retake</button>
                    <button
                      onClick={async () => {
                        const url = await onUploadVideo()
                        if (url) {
                          console.log('✅ Video saved successfully:', url)
                          await supabase.from('profiles').update({ video_url: url }).eq('id', user.id)
                          onSetMyGiverProfile({ ...myGiverProfile, video_url: url })
                          onSetVideoStep('done')
                          onSetRecordedUrl(null)
                          onSetProfileError('') // Clear any errors
                          onSetVideoJustSaved(true) // Show success message
                          // Auto-hide success message after 5 seconds
                          setTimeout(() => onSetVideoJustSaved(false), 5000)
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
            Your Availability
          </label>

          <div style={{ background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '3px', padding: '20px' }}>
            {/* Bulk Add */}
            <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: `2px solid ${colors.border}` }}>
              <h4 style={{ fontSize: '0.95rem', color: colors.textPrimary, marginBottom: '12px', fontWeight: 600 }}>Quick Add</h4>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Date</label>
                  <input type="date" value={bulkStartDate} onChange={(e) => onSetBulkStartDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>End Date</label>
                  <input type="date" value={bulkEndDate} min={bulkStartDate} onChange={(e) => onSetBulkEndDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8rem', color: colors.textSecondary, display: 'block', marginBottom: '6px' }}>Start Time</label>
                  <select value={bulkStartTime} onChange={(e) => onSetBulkStartTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem' }}>
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
                  <select value={bulkEndTime} onChange={(e) => onSetBulkEndTime(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '3px', border: `1px solid ${colors.border}`, background: colors.bgSecondary, color: colors.textPrimary, fontSize: '0.85rem' }}>
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
                    <div key={index} onClick={() => onToggleBulkDay(index)} style={{ padding: '10px 0', borderRadius: '3px', textAlign: 'center', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, background: bulkSelectedDays.has(index) ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.has(index) ? colors.bgPrimary : colors.textSecondary, border: `1px solid ${bulkSelectedDays.has(index) ? colors.accent : colors.border}`, minWidth: 0 }}>
                      {day}
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={onAddBulkSlots} disabled={bulkSelectedDays.size === 0} style={{ width: '100%', padding: '12px', borderRadius: '3px', border: 'none', background: bulkSelectedDays.size > 0 ? colors.accent : colors.bgSecondary, color: bulkSelectedDays.size > 0 ? colors.bgPrimary : colors.textMuted, cursor: bulkSelectedDays.size > 0 ? 'pointer' : 'not-allowed', fontSize: '0.9rem', fontWeight: 600 }}>
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
                      <button onClick={() => onRemoveSlot(slot.id)} style={{ padding: '4px 8px', borderRadius: '4px', border: 'none', background: 'transparent', color: colors.textMuted, cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={async () => {
                  if (confirm('Remove all availability slots?')) {
                    for (const slot of availabilitySlots) {
                      await supabase.from('giver_availability').delete().eq('id', slot.id)
                    }
                    onSetAvailabilitySlots([])
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
