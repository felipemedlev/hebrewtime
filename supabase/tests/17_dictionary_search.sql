-- Run after migration 17 against a disposable database or inside a transaction.
BEGIN;

INSERT INTO public.dictionary_entries (
  pealim_id, slug, url, word, word_with_nekudot, transliteration,
  part_of_speech, meaning, forms
) VALUES
  (2147000001, 'codex-search-test', 'https://example.invalid/codex-search-test',
    'מבחןקודקס', 'מִבְחָןקוֹדֶקְס', 'mivhancodex', 'Noun', 'test, codexmarker, to be lost',
    '[{"form_id":"p","hebrew_plain":"מבחניםקודקס"},{"form_id":"s-P-1s","hebrew_plain":"מבחניקודקס","aux_forms":[{"hebrew_plain":"מבחןקודקסתי"}]}]'::jsonb),
  (2147000002, 'codex-search-exam', 'https://example.invalid/codex-search-exam',
    'בחינהקודקס', 'בְּחִינָהקוֹדֶקְס', 'bechinacodex', 'Noun', 'test, codexquiz', '[]'::jsonb),
  (2147000003, 'codex-search-near', 'https://example.invalid/codex-search-near',
    'מילתסמןקודקס', 'מִלַּתסִמָןקוֹדֶקְס', 'milatsemancodex', 'Noun', 'codexmarkar', '[]'::jsonb);

DO $$
DECLARE
  result record;
  found_first boolean;
  found_second boolean;
BEGIN
  SELECT * INTO result FROM public.search_dictionary_suggestions('מִבְחָןקוֹדֶקְס', 8) LIMIT 1;
  IF result.pealim_id IS DISTINCT FROM 2147000001 OR result.match_type IS DISTINCT FROM 'headword' THEN
    RAISE EXCEPTION 'Expected normalized exact headword first; got % / %', result.pealim_id, result.match_type;
  END IF;

  SELECT * INTO result FROM public.search_dictionary_suggestions('מבחןקודקסתי', 8) LIMIT 1;
  IF result.pealim_id IS DISTINCT FROM 2147000001 OR result.match_type IS DISTINCT FROM 'form' OR result.matched_text IS DISTINCT FROM 'מבחןקודקסתי' THEN
    RAISE EXCEPTION 'Expected auxiliary inflection match; got % / % / %', result.pealim_id, result.match_type, result.matched_text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('מבחןקודקסותי', 8)
    WHERE pealim_id = 2147000001 AND match_type = 'fuzzy_form' AND matched_text = 'מבחןקודקסתי'
  ) THEN
    RAISE EXCEPTION 'Expected a misspelled inflection to retain its matched form';
  END IF;

  SELECT * INTO result FROM public.search_dictionary_suggestions('ובמבחןקודקס', 8) LIMIT 1;
  IF result.pealim_id IS DISTINCT FROM 2147000001 THEN
    RAISE EXCEPTION 'Expected conservative Hebrew prefix match; got %', result.pealim_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('codexmarkre', 8)
    WHERE pealim_id = 2147000001 AND match_type = 'fuzzy'
  ) THEN
    RAISE EXCEPTION 'Expected English gloss typo match';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('מבכחןקודקס', 8)
    WHERE pealim_id = 2147000001 AND match_type = 'fuzzy'
  ) THEN
    RAISE EXCEPTION 'Expected Hebrew insertion typo match';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('mivhancodxe', 8)
    WHERE pealim_id = 2147000001 AND match_type = 'fuzzy'
  ) THEN
    RAISE EXCEPTION 'Expected transliteration transposition typo match';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('be lost', 8)
    WHERE pealim_id = 2147000001 AND match_type = 'gloss'
  ) THEN
    RAISE EXCEPTION 'Expected multiword gloss phrase match';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('test—codexquiz', 8)
    WHERE pealim_id = 2147000002 AND match_type = 'gloss'
  ) THEN
    RAISE EXCEPTION 'Expected punctuation variants to normalize in gloss searches';
  END IF;

  SELECT * INTO result FROM public.search_dictionary_suggestions('codexmarker', 8) LIMIT 1;
  IF result.pealim_id IS DISTINCT FROM 2147000001 OR result.match_type IS DISTINCT FROM 'gloss' THEN
    RAISE EXCEPTION 'Expected exact gloss to rank above a typo correction; got % / %', result.pealim_id, result.match_type;
  END IF;

  SELECT bool_or(pealim_id = 2147000001), bool_or(pealim_id = 2147000002)
    INTO found_first, found_second
    FROM public.search_dictionary_suggestions('test', 8);
  IF NOT coalesce(found_first, false) OR NOT coalesce(found_second, false) THEN
    RAISE EXCEPTION 'Expected distinct entries sharing a gloss to remain selectable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('tx', 8)
    WHERE pealim_id IN (2147000001, 2147000002) AND match_type = 'fuzzy'
  ) THEN
    RAISE EXCEPTION 'Two-character queries must not use fuzzy matching';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('zzzxqv-not-a-word', 8)
    WHERE pealim_id IN (2147000001, 2147000002, 2147000003)
  ) THEN
    RAISE EXCEPTION 'Irrelevant input must not match the fixture entries';
  END IF;

  UPDATE public.dictionary_entries
  SET meaning = 'test, codexupdated, to be lost', meanings = ARRAY['freshcodexgloss']
  WHERE pealim_id = 2147000001;
  IF NOT EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('freshcodexgloss', 8)
    WHERE pealim_id = 2147000001 AND match_type = 'gloss'
  ) THEN
    RAISE EXCEPTION 'Meaning updates must refresh indexed terms';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('codexmarker', 8)
    WHERE pealim_id = 2147000001
  ) THEN
    RAISE EXCEPTION 'Old meaning terms must be removed after updates';
  END IF;

  UPDATE public.dictionary_entries SET forms = '[]'::jsonb WHERE pealim_id = 2147000001;
  IF EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('מבחןקודקסתי', 8)
    WHERE pealim_id = 2147000001 AND match_type = 'form'
  ) THEN
    RAISE EXCEPTION 'Form updates must remove old indexed forms';
  END IF;

  DELETE FROM public.dictionary_entries WHERE pealim_id = 2147000003;
  IF EXISTS (
    SELECT 1 FROM public.search_dictionary_suggestions('codexmarkar', 8)
    WHERE pealim_id = 2147000003
  ) THEN
    RAISE EXCEPTION 'Deleted dictionary entries must remove their indexed terms';
  END IF;
END;
$$;

ROLLBACK;
