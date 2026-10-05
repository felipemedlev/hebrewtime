# Dictionary search rollout

Run `supabase/migrations/17_dictionary_search.sql` after migrations 01–16 and **before** deploying the application changes. The migration backfills the search-term table, builds prefix and typo-candidate indexes, and installs a trigger to keep search terms current when dictionary entries change. The old `match_dictionary_word()` lookup remains available for transcript word resolution.

After applying the migration, check that each source entry has at least a headword term and that all four term kinds were populated:

```sql
SELECT
  (SELECT count(*) FROM public.dictionary_entries) AS dictionary_entries,
  (SELECT count(DISTINCT pealim_id) FROM public.dictionary_search_terms) AS indexed_entries;

SELECT kind, count(*) AS indexed_terms
FROM public.dictionary_search_terms
GROUP BY kind
ORDER BY kind;

SELECT count(*) AS entries_missing_headword_terms
FROM public.dictionary_entries e
WHERE NOT EXISTS (
  SELECT 1 FROM public.dictionary_search_terms t
  WHERE t.pealim_id = e.pealim_id AND t.kind = 'headword'
);
```

Run [`supabase/tests/17_dictionary_search.sql`](../supabase/tests/17_dictionary_search.sql) against a disposable database to check normalization and punctuation, exact-match ranking, forms and misspelled forms, prefixes, typos and transpositions, shared glosses, short queries, irrelevant input, and insert/update/delete synchronization. It inserts temporary fixture entries inside a transaction and rolls them back.

Inspect the representative warm query plan and latency in the Supabase SQL editor:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.search_dictionary_suggestions('מבחן', 8);
```

The candidate path should use the term indexes for prefix or delete-key matching. Measure a representative set of Hebrew, English, and transliteration queries after warming the database before assessing the 250 ms p95 database target; the client adds a 150 ms debounce. The migration has not been applied to the configured Supabase database from this task, so the backfill counts, live query plan, and latency target still need database verification.

To roll back the search index while retaining dictionary data, stop the updated application and run:

```sql
DROP TRIGGER IF EXISTS dictionary_search_terms_sync ON public.dictionary_entries;
DROP FUNCTION IF EXISTS public.search_dictionary_suggestions(text, integer);
DROP FUNCTION IF EXISTS public.sync_dictionary_search_terms();
DROP FUNCTION IF EXISTS public.refresh_dictionary_search_terms(integer);
DROP TABLE IF EXISTS public.dictionary_search_terms;
DROP FUNCTION IF EXISTS public.dictionary_search_deletes(text);
DROP FUNCTION IF EXISTS public.dictionary_edit_distance(text, text);
DROP FUNCTION IF EXISTS public.normalize_dictionary_search(text);
```
