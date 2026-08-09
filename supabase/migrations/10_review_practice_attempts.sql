-- Run in the Supabase SQL Editor to enable fill-in practice stats tracking.

CREATE TABLE IF NOT EXISTS public.review_practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vocab_id UUID REFERENCES public.vocabulary(id) ON DELETE CASCADE NOT NULL,
  modality TEXT NOT NULL DEFAULT 'fill_in',
  correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_practice_attempts_user_created_idx
  ON public.review_practice_attempts (user_id, created_at DESC);

ALTER TABLE public.review_practice_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own review practice attempts"
ON public.review_practice_attempts FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own review practice attempts"
ON public.review_practice_attempts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own review practice attempts"
ON public.review_practice_attempts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


ALTER TABLE public.user_activity_daily
  ADD COLUMN IF NOT EXISTS fill_in_count INTEGER NOT NULL DEFAULT 0 CHECK (fill_in_count >= 0);


CREATE OR REPLACE FUNCTION public.increment_fill_in_count(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_activity_daily (user_id, activity_date, fill_in_count, last_seen_at)
  VALUES (p_user_id, p_date, 1, NOW())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    fill_in_count = public.user_activity_daily.fill_in_count + 1,
    last_seen_at = GREATEST(public.user_activity_daily.last_seen_at, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.increment_fill_in_count(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_fill_in_count(UUID, DATE) FROM anon;
REVOKE ALL ON FUNCTION public.increment_fill_in_count(UUID, DATE) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_fill_in_count(UUID, DATE) TO service_role;
