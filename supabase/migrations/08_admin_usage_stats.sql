-- Run in Supabase SQL Editor to enable admin usage tracking and dashboard stats.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.user_activity_daily (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, activity_date)
);

ALTER TABLE public.user_activity_daily ENABLE ROW LEVEL SECURITY;

-- No client policies: writes go through server actions with service role only.

CREATE OR REPLACE FUNCTION public.increment_user_activity(
  p_user_id UUID,
  p_active_seconds INTEGER,
  p_activity_date DATE DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_active_seconds IS NULL OR p_active_seconds <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_activity_daily (user_id, activity_date, active_seconds, last_seen_at)
  VALUES (p_user_id, p_activity_date, p_active_seconds, NOW())
  ON CONFLICT (user_id, activity_date)
  DO UPDATE SET
    active_seconds = public.user_activity_daily.active_seconds + EXCLUDED.active_seconds,
    last_seen_at = GREATEST(public.user_activity_daily.last_seen_at, EXCLUDED.last_seen_at);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_user_activity(UUID, INTEGER, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_activity(UUID, INTEGER, DATE) TO service_role;
