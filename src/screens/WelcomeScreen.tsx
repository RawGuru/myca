// src/screens/WelcomeScreen.tsx
import React from 'react'
import type { User } from '@supabase/supabase-js'

interface WelcomeScreenProps {
  user: User | null
  hasGiverProfile: boolean
  onNavigate: (screen: string) => void
  onRequestAuth: () => void
  Nav: React.ComponentType
  SignOutButton: React.ComponentType
  colors: {
    bgPrimary: string
    textPrimary: string
    textSecondary: string
    textMuted: string
  }
  typography: {
    sm: string
    lg: string
    xl: string
  }
  spacing: {
    sm: string
    md: string
    lg: string
    xl: string
    xxl: string
  }
  containerStyle: React.CSSProperties
  screenStyle: React.CSSProperties
  btnStyle: React.CSSProperties
  btnSecondaryStyle: React.CSSProperties
}

export function WelcomeScreen({
  user,
  hasGiverProfile,
  onNavigate,
  onRequestAuth,
  Nav,
  SignOutButton,
  colors,
  typography,
  spacing,
  containerStyle,
  screenStyle,
  btnStyle,
  btnSecondaryStyle
}: WelcomeScreenProps) {
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
          <button style={btnStyle} onClick={() => onNavigate('browse')}>Get heard</button>
          <button
            style={btnSecondaryStyle}
            onClick={() => {
              // If user already has a giver profile, go to manage listings
              // Otherwise, go straight to listing form
              if (hasGiverProfile) {
                onNavigate('manageListings')
              } else {
                onNavigate('createListing')
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
              onClick={onRequestAuth}
            >
              Sign in
            </button>
          )}
        </div>

        {user && <Nav />}
      </div>
    </div>
  )
}
