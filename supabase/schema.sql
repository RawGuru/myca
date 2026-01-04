--
-- PostgreSQL database dump
--

\restrict 5pSWClBFmfJdatWp8XxkpsvGOW0DvQe4ShNYza4XkqbMssUcaHhqEbrqNPAeWGP

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: get_user_trust_metrics(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_trust_metrics(user_id_param uuid) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'is_new_user', (SELECT COUNT(*) < 3 FROM bookings WHERE seeker_id = user_id_param AND ended_at IS NOT NULL),
    'sessions_completed', (SELECT COUNT(*) FROM bookings WHERE seeker_id = user_id_param AND ended_at IS NOT NULL),
    'verification_status', 'verified'
  ) INTO result;
  RETURN result;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: blocked_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blocked_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    reason text
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seeker_id uuid,
    giver_id uuid,
    scheduled_time timestamp with time zone NOT NULL,
    duration_minutes integer NOT NULL,
    amount_cents integer NOT NULL,
    status text DEFAULT 'pending'::text,
    stripe_payment_id text,
    video_room_url text,
    created_at timestamp with time zone DEFAULT now(),
    giver_joined_at timestamp with time zone,
    seeker_credit_earned boolean DEFAULT false,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    elapsed_seconds integer,
    end_reason text,
    payout_net_cents integer,
    refund_gross_cents integer,
    payout_status text,
    session_intention text,
    CONSTRAINT bookings_end_reason_check CHECK ((end_reason = ANY (ARRAY['receiver_end_complete'::text, 'completed'::text, 'giver_safety_exit'::text, 'technical_failure'::text, 'receiver_no_show'::text, 'giver_no_show'::text]))),
    CONSTRAINT bookings_payout_status_check CHECK ((payout_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: COLUMN bookings.giver_joined_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.giver_joined_at IS 'Timestamp when giver joined the video session. Used for lateness detection.';


--
-- Name: COLUMN bookings.seeker_credit_earned; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.seeker_credit_earned IS 'Automatic credit earned when giver joins more than 2 minutes late. No requests needed.';


--
-- Name: COLUMN bookings.started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.started_at IS 'When session actually started (first participant joined)';


--
-- Name: COLUMN bookings.ended_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.ended_at IS 'When session ended';


--
-- Name: COLUMN bookings.elapsed_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.elapsed_seconds IS 'Total session duration in seconds';


--
-- Name: COLUMN bookings.end_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.end_reason IS 'Reason session ended (determines payout policy)';


--
-- Name: COLUMN bookings.payout_net_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.payout_net_cents IS 'Net payout to giver after pro-rating';


--
-- Name: COLUMN bookings.refund_gross_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.refund_gross_cents IS 'Refund amount to receiver';


--
-- Name: COLUMN bookings.payout_status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.payout_status IS 'Status of payout processing';


--
-- Name: credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount_cents integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    used_at timestamp with time zone,
    booking_id uuid,
    source_booking_id uuid,
    reason text,
    CONSTRAINT credits_reason_check CHECK ((reason = ANY (ARRAY['giver_safety_exit'::text, 'platform_failure'::text, 'goodwill'::text, 'giver_joined_late'::text])))
);


--
-- Name: TABLE credits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.credits IS 'Platform credits issued for safety exits, platform failures, or goodwill';


--
-- Name: COLUMN credits.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credits.user_id IS 'User who owns this credit';


--
-- Name: COLUMN credits.amount_cents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credits.amount_cents IS 'Credit amount in cents';


--
-- Name: COLUMN credits.used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credits.used_at IS 'When credit was applied to a booking (NULL if unused)';


--
-- Name: COLUMN credits.booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credits.booking_id IS 'Booking where this credit was applied';


--
-- Name: COLUMN credits.source_booking_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credits.source_booking_id IS 'Original booking that generated this credit';


--
-- Name: COLUMN credits.reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credits.reason IS 'Reason credit was issued: giver_safety_exit, platform_failure, goodwill, giver_joined_late';


--
-- Name: extensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extensions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    extended_at timestamp with time zone DEFAULT now(),
    amount_cents integer NOT NULL,
    stripe_payment_intent_id text,
    requested_by uuid,
    requested_at timestamp with time zone,
    giver_response text,
    giver_responded_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT extensions_giver_response_check CHECK ((giver_response = ANY (ARRAY['accepted'::text, 'declined'::text, 'timeout'::text]))),
    CONSTRAINT extensions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'timeout'::text, 'payment_failed'::text])))
);


--
-- Name: giver_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giver_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    giver_id uuid NOT NULL,
    date date NOT NULL,
    "time" time without time zone NOT NULL,
    is_booked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE giver_availability; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.giver_availability IS 'Calendar-based availability. Givers select specific dates/times. No weekly recurrence.';


--
-- Name: giver_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.giver_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    giver_id uuid NOT NULL,
    total_sessions_completed integer DEFAULT 0,
    would_book_again_count integer DEFAULT 0,
    matched_mode_count integer DEFAULT 0,
    quality_score numeric(3,2) GENERATED ALWAYS AS (
CASE
    WHEN (total_sessions_completed > 0) THEN ((((would_book_again_count)::numeric * 0.6) + ((matched_mode_count)::numeric * 0.4)) / (total_sessions_completed)::numeric)
    ELSE (0)::numeric
END) STORED,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: listing_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listing_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    listing_id uuid NOT NULL,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: listings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    topic text,
    mode text NOT NULL,
    price_cents integer NOT NULL,
    description text,
    specific_topics text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    directions_allowed text[] DEFAULT ARRAY['go_deeper'::text, 'hear_perspective'::text, 'think_together'::text, 'build_next_step'::text, 'end_cleanly'::text],
    boundaries text,
    allow_instant_book boolean DEFAULT false,
    requires_approval boolean DEFAULT true,
    CONSTRAINT listings_mode_check CHECK ((mode = ANY (ARRAY['vault'::text, 'mirror'::text, 'strategist'::text, 'teacher'::text, 'challenger'::text, 'vibe_check'::text]))),
    CONSTRAINT listings_price_cents_check CHECK ((price_cents >= 1500)),
    CONSTRAINT valid_directions CHECK ((directions_allowed <@ ARRAY['go_deeper'::text, 'hear_perspective'::text, 'think_together'::text, 'build_next_step'::text, 'end_cleanly'::text]))
);


--
-- Name: COLUMN listings.directions_allowed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listings.directions_allowed IS 'Pre-consented direction types giver allows: go_deeper, hear_perspective, think_together, build_next_step, end_cleanly';


--
-- Name: COLUMN listings.boundaries; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.listings.boundaries IS 'Giver boundaries and safety guidelines';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    name text,
    bio text,
    tagline text,
    video_url text,
    rate_per_30 integer DEFAULT 25,
    qualities_offered text[] DEFAULT '{}'::text[],
    is_giver boolean DEFAULT false,
    available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    availability_schedule jsonb,
    stripe_account_id text,
    stripe_onboarding_complete boolean DEFAULT false,
    timezone text DEFAULT 'America/New_York'::text,
    profile_picture_url text,
    photo_url text,
    sessions_completed integer DEFAULT 0,
    age_verified_at timestamp with time zone
);


--
-- Name: qualities_received; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qualities_received (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    giver_id uuid,
    quality_name text NOT NULL,
    count integer DEFAULT 1
);


--
-- Name: reflections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reflections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    giver_id uuid,
    seeker_id uuid,
    text text,
    qualities_selected text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: saved_givers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_givers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seeker_id uuid,
    giver_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: session_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    event_type text NOT NULL,
    user_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT session_milestones_event_type_check CHECK ((event_type = ANY (ARRAY['phase_transition'::text, 'validation_failed'::text, 'validation_succeeded'::text, 'auto_advance_transmission'::text, 'auto_advance_reflection'::text, 'extension_requested'::text, 'extension_granted'::text, 'extension_declined'::text, 'participant_disconnected'::text, 'participant_reconnected'::text, 'session_ended'::text, 'mic_permission_denied'::text])))
);


--
-- Name: session_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    current_phase text DEFAULT 'transmission'::text NOT NULL,
    validation_attempts integer DEFAULT 0,
    emergence_verb text,
    extension_pending boolean DEFAULT false,
    extension_id uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    transmission_started_at timestamp with time zone,
    reflection_started_at timestamp with time zone,
    validation_started_at timestamp with time zone,
    emergence_started_at timestamp with time zone,
    ended_at timestamp with time zone,
    end_reason text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    direction_selected text,
    direction_source text,
    direction_request_text text,
    direction_giver_response text,
    direction_started_at timestamp with time zone,
    CONSTRAINT session_states_current_phase_check CHECK ((current_phase = ANY (ARRAY['transmission'::text, 'reflection'::text, 'validation'::text, 'direction'::text, 'ended'::text]))),
    CONSTRAINT session_states_direction_giver_response_check CHECK ((direction_giver_response = ANY (ARRAY['accepted'::text, 'declined'::text]))),
    CONSTRAINT session_states_direction_selected_check CHECK ((direction_selected = ANY (ARRAY['go_deeper'::text, 'hear_perspective'::text, 'think_together'::text, 'build_next_step'::text, 'end_cleanly'::text]))),
    CONSTRAINT session_states_direction_source_check CHECK ((direction_source = ANY (ARRAY['pre_consented'::text, 'custom_request'::text]))),
    CONSTRAINT session_states_emergence_verb_check CHECK ((emergence_verb = ANY (ARRAY['explore'::text, 'strategize'::text, 'reflect_deeper'::text, 'challenge'::text, 'synthesize'::text, 'just_talk'::text]))),
    CONSTRAINT session_states_end_reason_check CHECK ((end_reason = ANY (ARRAY['completed'::text, 'time_expired'::text, 'participant_left'::text, 'error'::text, 'receiver_end_complete'::text, 'giver_safety_exit'::text, 'technical_failure'::text, 'receiver_no_show'::text, 'giver_no_show'::text])))
);


--
-- Name: COLUMN session_states.direction_selected; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_states.direction_selected IS 'Direction type selected by receiver';


--
-- Name: COLUMN session_states.direction_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_states.direction_source IS 'Whether direction was pre_consented or custom_request';


--
-- Name: COLUMN session_states.direction_request_text; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_states.direction_request_text IS 'Custom direction text if custom_request (200 char limit)';


--
-- Name: COLUMN session_states.direction_giver_response; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_states.direction_giver_response IS 'Giver response to custom direction request (accepted/declined)';


--
-- Name: COLUMN session_states.direction_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.session_states.direction_started_at IS 'When direction phase started';


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    timezone text DEFAULT 'America/New_York'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: blocked_users blocked_users_blocker_id_blocked_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);


--
-- Name: blocked_users blocked_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: credits credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_pkey PRIMARY KEY (id);


--
-- Name: extensions extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extensions
    ADD CONSTRAINT extensions_pkey PRIMARY KEY (id);


--
-- Name: giver_availability giver_availability_giver_id_date_time_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giver_availability
    ADD CONSTRAINT giver_availability_giver_id_date_time_key UNIQUE (giver_id, date, "time");


--
-- Name: giver_availability giver_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giver_availability
    ADD CONSTRAINT giver_availability_pkey PRIMARY KEY (id);


--
-- Name: giver_metrics giver_metrics_giver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giver_metrics
    ADD CONSTRAINT giver_metrics_giver_id_key UNIQUE (giver_id);


--
-- Name: giver_metrics giver_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giver_metrics
    ADD CONSTRAINT giver_metrics_pkey PRIMARY KEY (id);


--
-- Name: listing_categories listing_categories_listing_id_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_categories
    ADD CONSTRAINT listing_categories_listing_id_category_key UNIQUE (listing_id, category);


--
-- Name: listing_categories listing_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_categories
    ADD CONSTRAINT listing_categories_pkey PRIMARY KEY (id);


--
-- Name: listings listings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: qualities_received qualities_received_giver_id_quality_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualities_received
    ADD CONSTRAINT qualities_received_giver_id_quality_name_key UNIQUE (giver_id, quality_name);


--
-- Name: qualities_received qualities_received_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualities_received
    ADD CONSTRAINT qualities_received_pkey PRIMARY KEY (id);


--
-- Name: reflections reflections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reflections
    ADD CONSTRAINT reflections_pkey PRIMARY KEY (id);


--
-- Name: saved_givers saved_givers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_givers
    ADD CONSTRAINT saved_givers_pkey PRIMARY KEY (id);


--
-- Name: saved_givers saved_givers_seeker_id_giver_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_givers
    ADD CONSTRAINT saved_givers_seeker_id_giver_id_key UNIQUE (seeker_id, giver_id);


--
-- Name: session_milestones session_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_milestones
    ADD CONSTRAINT session_milestones_pkey PRIMARY KEY (id);


--
-- Name: session_states session_states_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_states
    ADD CONSTRAINT session_states_booking_id_key UNIQUE (booking_id);


--
-- Name: session_states session_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_states
    ADD CONSTRAINT session_states_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: idx_blocked_users_blocked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocked ON public.blocked_users USING btree (blocked_id);


--
-- Name: idx_blocked_users_blocker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blocked_users_blocker ON public.blocked_users USING btree (blocker_id);


--
-- Name: idx_bookings_end_reason; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_end_reason ON public.bookings USING btree (end_reason);


--
-- Name: idx_bookings_payout_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_payout_status ON public.bookings USING btree (payout_status);


--
-- Name: idx_bookings_video_room_url; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_video_room_url ON public.bookings USING btree (video_room_url);


--
-- Name: idx_credits_unused; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_unused ON public.credits USING btree (user_id) WHERE (used_at IS NULL);


--
-- Name: idx_credits_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credits_user_id ON public.credits USING btree (user_id);


--
-- Name: idx_giver_availability_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giver_availability_date ON public.giver_availability USING btree (date);


--
-- Name: idx_giver_availability_giver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_giver_availability_giver ON public.giver_availability USING btree (giver_id);


--
-- Name: idx_session_milestones_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_milestones_booking ON public.session_milestones USING btree (booking_id);


--
-- Name: idx_session_milestones_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_milestones_created_at ON public.session_milestones USING btree (created_at);


--
-- Name: idx_session_milestones_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_milestones_event_type ON public.session_milestones USING btree (event_type);


--
-- Name: idx_session_states_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_states_booking ON public.session_states USING btree (booking_id);


--
-- Name: idx_session_states_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_states_phase ON public.session_states USING btree (current_phase);


--
-- Name: blocked_users blocked_users_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: blocked_users blocked_users_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blocked_users
    ADD CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_giver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_seeker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_seeker_id_fkey FOREIGN KEY (seeker_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: credits credits_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: credits credits_source_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_source_booking_id_fkey FOREIGN KEY (source_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: credits credits_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: extensions extensions_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extensions
    ADD CONSTRAINT extensions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: extensions extensions_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extensions
    ADD CONSTRAINT extensions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id);


--
-- Name: giver_availability giver_availability_giver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giver_availability
    ADD CONSTRAINT giver_availability_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: giver_metrics giver_metrics_giver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.giver_metrics
    ADD CONSTRAINT giver_metrics_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: listing_categories listing_categories_listing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listing_categories
    ADD CONSTRAINT listing_categories_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;


--
-- Name: listings listings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listings
    ADD CONSTRAINT listings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: qualities_received qualities_received_giver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qualities_received
    ADD CONSTRAINT qualities_received_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reflections reflections_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reflections
    ADD CONSTRAINT reflections_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: reflections reflections_giver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reflections
    ADD CONSTRAINT reflections_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.profiles(id);


--
-- Name: reflections reflections_seeker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reflections
    ADD CONSTRAINT reflections_seeker_id_fkey FOREIGN KEY (seeker_id) REFERENCES public.profiles(id);


--
-- Name: saved_givers saved_givers_seeker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_givers
    ADD CONSTRAINT saved_givers_seeker_id_fkey FOREIGN KEY (seeker_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: session_milestones session_milestones_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_milestones
    ADD CONSTRAINT session_milestones_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: session_milestones session_milestones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_milestones
    ADD CONSTRAINT session_milestones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: session_states session_states_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_states
    ADD CONSTRAINT session_states_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;


--
-- Name: session_states session_states_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_states
    ADD CONSTRAINT session_states_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: giver_metrics Allow read access for discovery ranking; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access for discovery ranking" ON public.giver_metrics FOR SELECT USING (true);


--
-- Name: listings Anyone can view active listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view active listings" ON public.listings FOR SELECT USING ((is_active = true));


--
-- Name: giver_availability Anyone can view available slots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view available slots" ON public.giver_availability FOR SELECT USING ((is_booked = false));


--
-- Name: listing_categories Anyone can view categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view categories" ON public.listing_categories FOR SELECT USING (true);


--
-- Name: session_states Booking participants can insert session state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Booking participants can insert session state" ON public.session_states FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = session_states.booking_id) AND ((bookings.seeker_id = auth.uid()) OR (bookings.giver_id = auth.uid()))))));


--
-- Name: session_states Booking participants can update session state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Booking participants can update session state" ON public.session_states FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = session_states.booking_id) AND ((bookings.seeker_id = auth.uid()) OR (bookings.giver_id = auth.uid()))))));


--
-- Name: session_milestones Booking participants can view milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Booking participants can view milestones" ON public.session_milestones FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = session_milestones.booking_id) AND ((bookings.seeker_id = auth.uid()) OR (bookings.giver_id = auth.uid()))))));


--
-- Name: session_states Booking participants can view session state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Booking participants can view session state" ON public.session_states FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = session_states.booking_id) AND ((bookings.seeker_id = auth.uid()) OR (bookings.giver_id = auth.uid()))))));


--
-- Name: giver_availability Givers can delete their availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Givers can delete their availability" ON public.giver_availability FOR DELETE USING ((auth.uid() = giver_id));


--
-- Name: giver_availability Givers can insert their availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Givers can insert their availability" ON public.giver_availability FOR INSERT WITH CHECK ((auth.uid() = giver_id));


--
-- Name: giver_availability Givers can update their availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Givers can update their availability" ON public.giver_availability FOR UPDATE USING ((auth.uid() = giver_id));


--
-- Name: bookings Givers can update their bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Givers can update their bookings" ON public.bookings FOR UPDATE USING ((auth.uid() = giver_id)) WITH CHECK ((auth.uid() = giver_id));


--
-- Name: giver_availability Givers can view their availability; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Givers can view their availability" ON public.giver_availability FOR SELECT USING ((auth.uid() = giver_id));


--
-- Name: bookings Givers can view their bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Givers can view their bookings" ON public.bookings FOR SELECT USING ((auth.uid() = giver_id));


--
-- Name: giver_metrics Only system can delete giver metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only system can delete giver metrics" ON public.giver_metrics FOR DELETE USING (false);


--
-- Name: giver_metrics Only system can modify giver metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only system can modify giver metrics" ON public.giver_metrics FOR INSERT WITH CHECK (false);


--
-- Name: giver_metrics Only system can update giver metrics; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only system can update giver metrics" ON public.giver_metrics FOR UPDATE USING (false);


--
-- Name: listing_categories Owners can manage categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage categories" ON public.listing_categories USING ((EXISTS ( SELECT 1
   FROM public.listings
  WHERE ((listings.id = listing_categories.listing_id) AND (listings.user_id = auth.uid())))));


--
-- Name: extensions Participants can create extensions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can create extensions" ON public.extensions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = extensions.booking_id) AND ((bookings.seeker_id = auth.uid()) OR (bookings.giver_id = auth.uid()))))));


--
-- Name: reflections Participants can create reflections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can create reflections" ON public.reflections FOR INSERT WITH CHECK (((auth.uid() = seeker_id) OR (auth.uid() = giver_id)));


--
-- Name: extensions Participants can update their extensions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can update their extensions" ON public.extensions FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = extensions.booking_id) AND ((bookings.seeker_id = auth.uid()) OR (bookings.giver_id = auth.uid()))))));


--
-- Name: extensions Participants can view their extensions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view their extensions" ON public.extensions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.bookings
  WHERE ((bookings.id = extensions.booking_id) AND ((bookings.seeker_id = auth.uid()) OR (bookings.giver_id = auth.uid()))))));


--
-- Name: profiles Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: qualities_received Qualities are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Qualities are viewable by everyone" ON public.qualities_received FOR SELECT USING (true);


--
-- Name: reflections Reflections viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Reflections viewable by everyone" ON public.reflections FOR SELECT USING (true);


--
-- Name: bookings Seekers can insert bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seekers can insert bookings" ON public.bookings FOR INSERT WITH CHECK ((auth.uid() = seeker_id));


--
-- Name: bookings Seekers can update their bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seekers can update their bookings" ON public.bookings FOR UPDATE USING ((auth.uid() = seeker_id)) WITH CHECK ((auth.uid() = seeker_id));


--
-- Name: bookings Seekers can view their bookings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Seekers can view their bookings" ON public.bookings FOR SELECT USING ((auth.uid() = seeker_id));


--
-- Name: session_milestones System can insert milestones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can insert milestones" ON public.session_milestones FOR INSERT WITH CHECK (true);


--
-- Name: blocked_users Users can create blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create blocks" ON public.blocked_users FOR INSERT WITH CHECK ((auth.uid() = blocker_id));


--
-- Name: listings Users can create own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own listings" ON public.listings FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: listings Users can delete own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own listings" ON public.listings FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: blocked_users Users can delete their own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own blocks" ON public.blocked_users FOR DELETE USING ((auth.uid() = blocker_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: user_profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: saved_givers Users can manage own saves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own saves" ON public.saved_givers USING ((auth.uid() = seeker_id));


--
-- Name: listings Users can update own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own listings" ON public.listings FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: user_profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: listings Users can view own listings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own listings" ON public.listings FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.user_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: blocked_users Users can view their own blocks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own blocks" ON public.blocked_users FOR SELECT USING ((auth.uid() = blocker_id));


--
-- Name: blocked_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: extensions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extensions ENABLE ROW LEVEL SECURITY;

--
-- Name: giver_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.giver_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: giver_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.giver_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: listing_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listing_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: listings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: qualities_received; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qualities_received ENABLE ROW LEVEL SECURITY;

--
-- Name: reflections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_givers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.saved_givers ENABLE ROW LEVEL SECURITY;

--
-- Name: session_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: session_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.session_states ENABLE ROW LEVEL SECURITY;

--
-- Name: user_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 5pSWClBFmfJdatWp8XxkpsvGOW0DvQe4ShNYza4XkqbMssUcaHhqEbrqNPAeWGP

