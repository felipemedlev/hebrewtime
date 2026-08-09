-- FSRS migration: add columns for Free Spaced Repetition Scheduler (ts-fsrs)
-- Run in Supabase SQL Editor on existing projects that already have flashcard_progress.

ALTER TABLE public.flashcard_progress
  ADD COLUMN IF NOT EXISTS stability DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS difficulty DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS state INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lapses INTEGER NOT NULL DEFAULT 0;

-- Existing SM-2 rows keep working: null stability is migrated on the next review in app code.
-- Reused columns: next_review_at (due), last_reviewed_at (last_review), repetitions (reps),
-- interval_days (scheduled_days). ease_factor is no longer updated by the app.
