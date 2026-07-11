-- Add direction column to flashcard_progress for separate forward/reverse FSRS schedules.
-- Run in Supabase SQL Editor on existing projects that already have flashcard_progress.

ALTER TABLE public.flashcard_progress
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'forward';

ALTER TABLE public.flashcard_progress
  DROP CONSTRAINT IF EXISTS flashcard_progress_user_id_vocab_id_key;

ALTER TABLE public.flashcard_progress
  ADD CONSTRAINT flashcard_progress_user_id_vocab_id_direction_key
  UNIQUE (user_id, vocab_id, direction);
