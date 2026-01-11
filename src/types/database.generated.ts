export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      blocked_users: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string | null
          reason: string | null
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string | null
          reason?: string | null
        }
        Update: {
          id?: string
          blocker_id?: string
          blocked_id?: string
          created_at?: string | null
          reason?: string | null
        }
      }
      bookings: {
        Row: {
          id: string
          seeker_id: string | null
          giver_id: string | null
          scheduled_time: string
          duration_minutes: number
          amount_cents: number
          status: string | null
          stripe_payment_id: string | null
          video_room_url: string | null
          created_at: string | null
          giver_joined_at: string | null
          seeker_credit_earned: boolean | null
          started_at: string | null
          ended_at: string | null
          elapsed_seconds: number | null
          end_reason: string | null
          payout_net_cents: number | null
          refund_gross_cents: number | null
          payout_status: string | null
          session_intention: string | null
        }
        Insert: {
          id?: string
          seeker_id?: string | null
          giver_id?: string | null
          scheduled_time: string
          duration_minutes: number
          amount_cents: number
          status?: string | null
          stripe_payment_id?: string | null
          video_room_url?: string | null
          created_at?: string | null
          giver_joined_at?: string | null
          seeker_credit_earned?: boolean | null
          started_at?: string | null
          ended_at?: string | null
          elapsed_seconds?: number | null
          end_reason?: string | null
          payout_net_cents?: number | null
          refund_gross_cents?: number | null
          payout_status?: string | null
          session_intention?: string | null
        }
        Update: {
          id?: string
          seeker_id?: string | null
          giver_id?: string | null
          scheduled_time?: string
          duration_minutes?: number
          amount_cents?: number
          status?: string | null
          stripe_payment_id?: string | null
          video_room_url?: string | null
          created_at?: string | null
          giver_joined_at?: string | null
          seeker_credit_earned?: boolean | null
          started_at?: string | null
          ended_at?: string | null
          elapsed_seconds?: number | null
          end_reason?: string | null
          payout_net_cents?: number | null
          refund_gross_cents?: number | null
          payout_status?: string | null
          session_intention?: string | null
        }
      }
      credits: {
        Row: {
          id: string
          user_id: string
          amount_cents: number
          created_at: string | null
          used_at: string | null
          booking_id: string | null
          source_booking_id: string | null
          reason: string | null
        }
        Insert: {
          id?: string
          user_id: string
          amount_cents: number
          created_at?: string | null
          used_at?: string | null
          booking_id?: string | null
          source_booking_id?: string | null
          reason?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          amount_cents?: number
          created_at?: string | null
          used_at?: string | null
          booking_id?: string | null
          source_booking_id?: string | null
          reason?: string | null
        }
      }
      extensions: {
        Row: {
          id: string
          booking_id: string
          extended_at: string | null
          amount_cents: number
          stripe_payment_intent_id: string | null
          requested_by: string | null
          requested_at: string | null
          giver_response: string | null
          giver_responded_at: string | null
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          booking_id: string
          extended_at?: string | null
          amount_cents: number
          stripe_payment_intent_id?: string | null
          requested_by?: string | null
          requested_at?: string | null
          giver_response?: string | null
          giver_responded_at?: string | null
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          booking_id?: string
          extended_at?: string | null
          amount_cents?: number
          stripe_payment_intent_id?: string | null
          requested_by?: string | null
          requested_at?: string | null
          giver_response?: string | null
          giver_responded_at?: string | null
          status?: string
          created_at?: string | null
        }
      }
      giver_availability: {
        Row: {
          id: string
          giver_id: string
          date: string
          time: string
          is_booked: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          giver_id: string
          date: string
          time: string
          is_booked?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          giver_id?: string
          date?: string
          time?: string
          is_booked?: boolean | null
          created_at?: string | null
        }
      }
      giver_metrics: {
        Row: {
          id: string
          giver_id: string
          total_sessions_completed: number | null
          would_book_again_count: number | null
          matched_mode_count: number | null
          quality_score: number | null
          updated_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          giver_id: string
          total_sessions_completed?: number | null
          would_book_again_count?: number | null
          matched_mode_count?: number | null
          quality_score?: number | null
          updated_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          giver_id?: string
          total_sessions_completed?: number | null
          would_book_again_count?: number | null
          matched_mode_count?: number | null
          quality_score?: number | null
          updated_at?: string | null
          created_at?: string | null
        }
      }
      listing_categories: {
        Row: {
          id: string
          listing_id: string
          category: string
          created_at: string | null
        }
        Insert: {
          id?: string
          listing_id: string
          category: string
          created_at?: string | null
        }
        Update: {
          id?: string
          listing_id?: string
          category?: string
          created_at?: string | null
        }
      }
      listings: {
        Row: {
          id: string
          user_id: string
          topic: string | null
          mode: string
          price_cents: number
          description: string | null
          specific_topics: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          directions_allowed: string[] | null
          boundaries: string | null
          allow_instant_book: boolean | null
          requires_approval: boolean | null
        }
        Insert: {
          id?: string
          user_id: string
          topic?: string | null
          mode: string
          price_cents: number
          description?: string | null
          specific_topics?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          directions_allowed?: string[] | null
          boundaries?: string | null
          allow_instant_book?: boolean | null
          requires_approval?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string
          topic?: string | null
          mode?: string
          price_cents?: number
          description?: string | null
          specific_topics?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          directions_allowed?: string[] | null
          boundaries?: string | null
          allow_instant_book?: boolean | null
          requires_approval?: boolean | null
        }
      }
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          bio: string | null
          tagline: string | null
          video_url: string | null
          rate_per_30: number | null
          qualities_offered: string[] | null
          is_giver: boolean | null
          available: boolean | null
          created_at: string | null
          updated_at: string | null
          availability_schedule: Json | null
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          timezone: string | null
          profile_picture_url: string | null
          photo_url: string | null
          sessions_completed: number | null
          age_verified_at: string | null
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          bio?: string | null
          tagline?: string | null
          video_url?: string | null
          rate_per_30?: number | null
          qualities_offered?: string[] | null
          is_giver?: boolean | null
          available?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          availability_schedule?: Json | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          timezone?: string | null
          profile_picture_url?: string | null
          photo_url?: string | null
          sessions_completed?: number | null
          age_verified_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          bio?: string | null
          tagline?: string | null
          video_url?: string | null
          rate_per_30?: number | null
          qualities_offered?: string[] | null
          is_giver?: boolean | null
          available?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          availability_schedule?: Json | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          timezone?: string | null
          profile_picture_url?: string | null
          photo_url?: string | null
          sessions_completed?: number | null
          age_verified_at?: string | null
        }
      }
      qualities_received: {
        Row: {
          id: string
          giver_id: string | null
          quality_name: string
          count: number | null
        }
        Insert: {
          id?: string
          giver_id?: string | null
          quality_name: string
          count?: number | null
        }
        Update: {
          id?: string
          giver_id?: string | null
          quality_name?: string
          count?: number | null
        }
      }
      reflections: {
        Row: {
          id: string
          booking_id: string | null
          giver_id: string | null
          seeker_id: string | null
          text: string | null
          qualities_selected: string[] | null
          created_at: string | null
        }
        Insert: {
          id?: string
          booking_id?: string | null
          giver_id?: string | null
          seeker_id?: string | null
          text?: string | null
          qualities_selected?: string[] | null
          created_at?: string | null
        }
        Update: {
          id?: string
          booking_id?: string | null
          giver_id?: string | null
          seeker_id?: string | null
          text?: string | null
          qualities_selected?: string[] | null
          created_at?: string | null
        }
      }
      saved_givers: {
        Row: {
          id: string
          seeker_id: string | null
          giver_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          seeker_id?: string | null
          giver_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          seeker_id?: string | null
          giver_id?: string
          created_at?: string | null
        }
      }
      session_milestones: {
        Row: {
          id: string
          booking_id: string
          event_type: string
          user_id: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          booking_id: string
          event_type: string
          user_id?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          booking_id?: string
          event_type?: string
          user_id?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
      session_states: {
        Row: {
          id: string
          booking_id: string
          current_phase: string
          validation_attempts: number | null
          emergence_verb: string | null
          extension_pending: boolean | null
          extension_id: string | null
          started_at: string
          transmission_started_at: string | null
          reflection_started_at: string | null
          validation_started_at: string | null
          emergence_started_at: string | null
          ended_at: string | null
          end_reason: string | null
          updated_at: string | null
          updated_by: string | null
          created_at: string | null
          direction_selected: string | null
          direction_source: string | null
          direction_request_text: string | null
          direction_giver_response: string | null
          direction_started_at: string | null
        }
        Insert: {
          id?: string
          booking_id: string
          current_phase?: string
          validation_attempts?: number | null
          emergence_verb?: string | null
          extension_pending?: boolean | null
          extension_id?: string | null
          started_at?: string
          transmission_started_at?: string | null
          reflection_started_at?: string | null
          validation_started_at?: string | null
          emergence_started_at?: string | null
          ended_at?: string | null
          end_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
          created_at?: string | null
          direction_selected?: string | null
          direction_source?: string | null
          direction_request_text?: string | null
          direction_giver_response?: string | null
          direction_started_at?: string | null
        }
        Update: {
          id?: string
          booking_id?: string
          current_phase?: string
          validation_attempts?: number | null
          emergence_verb?: string | null
          extension_pending?: boolean | null
          extension_id?: string | null
          started_at?: string
          transmission_started_at?: string | null
          reflection_started_at?: string | null
          validation_started_at?: string | null
          emergence_started_at?: string | null
          ended_at?: string | null
          end_reason?: string | null
          updated_at?: string | null
          updated_by?: string | null
          created_at?: string | null
          direction_selected?: string | null
          direction_source?: string | null
          direction_request_text?: string | null
          direction_giver_response?: string | null
          direction_started_at?: string | null
        }
      }
      user_profiles: {
        Row: {
          id: string
          timezone: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
