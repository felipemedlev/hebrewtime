-- Vocabulary entry kind: word (Pealim lemma) vs phrase (user typed expression).
-- Safe to re-run (IF NOT EXISTS).

ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS entry_kind TEXT NOT NULL DEFAULT 'word';

ALTER TABLE public.vocabulary
  DROP CONSTRAINT IF EXISTS vocabulary_entry_kind_check;

ALTER TABLE public.vocabulary
  ADD CONSTRAINT vocabulary_entry_kind_check
  CHECK (entry_kind IN ('word', 'phrase'));
