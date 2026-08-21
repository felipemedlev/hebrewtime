-- Speak: scene preference + compact session notes (recasts / target phrases).
-- Safe to re-run.

ALTER TABLE public.speak_profiles
  ADD COLUMN IF NOT EXISTS scene TEXT NOT NULL DEFAULT 'introductions';

ALTER TABLE public.speak_profiles
  DROP CONSTRAINT IF EXISTS speak_profiles_scene_check;

ALTER TABLE public.speak_profiles
  ADD CONSTRAINT speak_profiles_scene_check
  CHECK (scene IN (
    'introductions',
    'cafe',
    'directions',
    'daily_routine',
    'phone_call',
    'about_your_day'
  ));

ALTER TABLE public.speak_profiles
  ADD COLUMN IF NOT EXISTS session_notes JSONB NOT NULL DEFAULT '{}'::jsonb;
