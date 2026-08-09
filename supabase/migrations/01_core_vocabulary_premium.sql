-- Core HebrewTime schema: vocabulary, flashcards, premium, finished episodes.
-- Run first on a fresh Supabase project. Safe to re-run (IF NOT EXISTS / OR REPLACE).

CREATE TABLE IF NOT EXISTS public.vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  word_with_nekudot TEXT,
  verb_form_with_nekudot TEXT,
  translation TEXT NOT NULL,
  pronunciation TEXT,
  episode_title TEXT,
  episode_url TEXT,
  saved_at BIGINT,
  example_phrases JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_premium_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.premium_users pu
    JOIN auth.users u ON lower(u.email) = lower(pu.email)
    WHERE u.id = auth.uid()
      AND pu.is_premium = true
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_premium_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_premium_access() TO authenticated;

CREATE POLICY "Premium users view own vocabulary" ON public.vocabulary FOR SELECT USING (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users insert own vocabulary" ON public.vocabulary FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users update own vocabulary" ON public.vocabulary FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access()) WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users delete own vocabulary" ON public.vocabulary FOR DELETE USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE TABLE IF NOT EXISTS public.flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vocab_id UUID REFERENCES public.vocabulary(id) ON DELETE CASCADE NOT NULL,
  ease_factor DOUBLE PRECISION DEFAULT 2.5 NOT NULL,
  interval_days INTEGER DEFAULT 0 NOT NULL,
  repetitions INTEGER DEFAULT 0 NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  is_learned BOOLEAN DEFAULT FALSE NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, vocab_id)
);
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Premium users view own flashcard progress" ON public.flashcard_progress FOR SELECT USING (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users insert own flashcard progress" ON public.flashcard_progress FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users update own flashcard progress" ON public.flashcard_progress FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access()) WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users delete own flashcard progress" ON public.flashcard_progress FOR DELETE USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE TABLE IF NOT EXISTS public.premium_users (
  email TEXT PRIMARY KEY,
  is_premium BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.premium_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own premium status"
ON public.premium_users
FOR SELECT
TO authenticated
USING (
  lower(email) = lower((
    SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
  ))
);

CREATE TABLE IF NOT EXISTS public.finished_episodes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level_slug TEXT NOT NULL DEFAULT 'intermediate',
  episode_number INTEGER NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, level_slug, episode_number)
);
ALTER TABLE public.finished_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own finished episodes" ON public.finished_episodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own finished episodes" ON public.finished_episodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own finished episodes" ON public.finished_episodes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS premium_users_set_updated_at ON public.premium_users;
CREATE TRIGGER premium_users_set_updated_at
BEFORE UPDATE ON public.premium_users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
