-- Reference dictionary from pealim.com (separate from per-user vocabulary saves).
CREATE TABLE IF NOT EXISTS public.dictionary_entries (
  pealim_id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  word TEXT NOT NULL,
  word_with_nekudot TEXT NOT NULL,
  transliteration TEXT,
  audio_url TEXT,
  root TEXT,
  part_of_speech TEXT NOT NULL,
  pos_detail TEXT,
  meaning TEXT NOT NULL,
  meanings TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT[] NOT NULL DEFAULT '{}',
  conjugation_sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  forms JSONB NOT NULL DEFAULT '[]'::jsonb,
  see_also_ids INTEGER[] NOT NULL DEFAULT '{}',
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dictionary_entries_word_idx
  ON public.dictionary_entries (word);

CREATE INDEX IF NOT EXISTS dictionary_entries_word_nekudot_idx
  ON public.dictionary_entries (word_with_nekudot);

CREATE INDEX IF NOT EXISTS dictionary_entries_pos_idx
  ON public.dictionary_entries (part_of_speech);

CREATE INDEX IF NOT EXISTS dictionary_entries_forms_gin_idx
  ON public.dictionary_entries USING GIN (forms);

ALTER TABLE public.dictionary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read dictionary" ON public.dictionary_entries;
CREATE POLICY "Authenticated users can read dictionary"
  ON public.dictionary_entries
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional: link saved vocabulary to the canonical dictionary row.
ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS dictionary_pealim_id INTEGER
  REFERENCES public.dictionary_entries(pealim_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vocabulary_dictionary_pealim_id_idx
  ON public.vocabulary (dictionary_pealim_id)
  WHERE dictionary_pealim_id IS NOT NULL;
