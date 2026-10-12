-- Source of truth: the configured Supabase Postgres database.
-- Grain: one row per database constraint, policy, column, or vocabulary kind.
-- Read only diagnostics used to investigate stale vocabulary reviews.

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.flashcard_progress'::regclass;

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'flashcard_progress';

SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'vocabulary';

SELECT v.entry_kind, count(*) AS vocabulary_count, count(p.id) AS progress_count
FROM public.vocabulary v
LEFT JOIN public.flashcard_progress p ON p.vocab_id = v.id AND p.direction = 'forward'
GROUP BY v.entry_kind;

SELECT v.entry_kind, count(*) AS progress_count,
  count(*) FILTER (WHERE p.user_id <> v.user_id) AS owner_mismatch_count
FROM public.flashcard_progress p
JOIN public.vocabulary v ON v.id = p.vocab_id
GROUP BY v.entry_kind;

SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid IN ('public.flashcard_progress'::regclass, 'public.vocabulary'::regclass)
  AND NOT tgisinternal;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vocabulary'
ORDER BY ordinal_position;

-- Verify that an authenticated phrase owner can save a review.
-- Always roll back. Never change learner progress with this test.
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated')::text, true) IS NOT NULL AS claims_set
FROM public.vocabulary
WHERE entry_kind = 'phrase'
ORDER BY saved_at DESC, id
LIMIT 1;
SET LOCAL ROLE authenticated;
WITH chosen AS (
  SELECT id, user_id
  FROM public.vocabulary
  WHERE entry_kind = 'phrase'
  ORDER BY saved_at DESC, id
  LIMIT 1
), saved AS (
  INSERT INTO public.flashcard_progress (user_id, vocab_id, direction, next_review_at)
  SELECT user_id, id, 'forward', NOW() FROM chosen
  ON CONFLICT (user_id, vocab_id, direction)
  DO UPDATE SET next_review_at = EXCLUDED.next_review_at
  RETURNING id
)
SELECT count(*) AS saved_count FROM saved;
ROLLBACK;
