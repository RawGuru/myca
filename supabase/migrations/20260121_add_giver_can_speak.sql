-- Add giver_can_speak column to session_states for server-side mute rules

ALTER TABLE session_states
ADD COLUMN IF NOT EXISTS giver_can_speak BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN session_states.giver_can_speak IS 'Server-controlled flag: FALSE during transmission phase, TRUE otherwise';
