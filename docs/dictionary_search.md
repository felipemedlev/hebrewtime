# Dictionary search and rollout

The source of truth is `dictionary_entries`. The derived `dictionary_search_terms` table stores normalized search terms. Each returned list contains at most one result per Pealim entry, with eight results by default.

## Search stages

The modal waits 150ms after typing a new query, then requests `/api/dictionary/suggest?q=...&mode=direct`. This calls `search_dictionary_suggestions_direct(search_query, result_limit)` and searches headwords, forms, transliterations, English glosses, and conservative Hebrew prefixes. It does not calculate spelling candidates.

Direct responses retain the existing `suggestions` and `status` fields and add `needsCompletion`. Completion is eligible when fewer than eight results exist and the normalized query is one term with 3 to 40 characters. Short queries, phrases, and full lists need only one request.

When needed, the modal requests `mode=complete` in the background. This uses the existing `search_dictionary_suggestions(search_query, result_limit)` signature. Omitting `mode` still means complete search. Both stages keep the existing success, empty, unavailable, and rate limited responses. Both count toward the existing request limit.

Direct matches stay visible and selectable during completion. Completing the list preserves the active dictionary ID. A completion failure retains direct matches and offers retry. Changing the query, selecting a word, changing mode, closing, or unmounting cancels pending browser requests and prevents stale responses from updating the modal.

Successful results stay in memory for five minutes. The modal cache holds 128 queries across closes while the component remains mounted. Completed cached lists display immediately without a request or debounce. The server cache holds 512 responses per Supabase client and separates direct and complete keys. Failed responses are never cached. A missing RPC uses the compatibility dictionary entry search, and its availability is checked again after one minute for new queries. Apply migration 18 before deploying to retain the full direct search features.

The dialog renders in `document.body`. Its popup is outside the scrolling card and inside the dialog focus scope. It follows the search row during scrolling and viewport changes. It prefers below the input when several rows fit, otherwise uses the space above. Maximum height is 420px, limited by the visible viewport with a 16px margin. Results scroll inside the popup. Text wraps instead of being shortened.

## Migrations

Apply migration 17 after migrations 01 to 16. It backfills terms, builds indexes, and installs a synchronization trigger. Apply `supabase/migrations/18_dictionary_search_performance.sql` after 17, first in staging and then in production. Migration 18 is transactional and can be applied again safely. It adds an index with C collation for explicit prefix bounds, installs the direct RPC, replaces complete search, and refreshes term statistics. Dictionary records and historical migrations remain unchanged. RPC permissions remain restricted to the service role.

Complete search returns direct matches first and calculates spelling alternatives only when slots remain. It looks up individual delete keys through the GIN index before applying length and entry filters. This ordering avoids a planner choice that scans many terms before checking keys. Distance is calculated once per distinct candidate term. Result ranking and match details remain compatible with migration 17.

Check coverage after migration:

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

## Verification

Run `npm test`, `npm run lint`, and `npm run build`. SQL fixture suites are `supabase/tests/17_dictionary_search.sql` and `supabase/tests/18_dictionary_search_performance.sql`. Run them in a disposable database. Both roll back their fixture changes. The second suite temporarily replaces the distance function inside its transaction to prove that a full direct list never evaluates spelling correction.

The saved validation script uses a disposable in memory PostgreSQL instance through PGlite. It needs Node.js with TypeScript stripping support. Install PGlite outside the repository and pass its module path:

```bash
npm install --prefix /private/tmp/hebrewtime-search-validation --no-audit --no-fund @electric-sql/pglite
node scripts/validate_dictionary_search.mjs /private/tmp/hebrewtime-search-validation/node_modules/@electric-sql/pglite/dist/index.js
```

This script uses no credentials or customer data. It checks migration idempotence, 17 complete result comparisons against migration 17, direct ranking, normalization equivalence, existing fixtures, permissions, skipped spelling work, and query plans. It writes a new dated JSON report under `outputs/` without replacing previous reports.

For staging, compare SQL execution time separately from API response time. Inspect both stages with `EXPLAIN (ANALYZE, BUFFERS)` and measure a representative set of Hebrew, English, transliteration, short, and misspelled queries after warming the database. Record p50 and p95 over at least 50 samples for each stage. The database target remains 250ms at p95. Check prefix and spelling candidate plans as well as the outer function calls, since a PL/pgSQL function scan alone hides its internal plan.

## Validation on October 11, 2026

The configured Supabase database accepted the complete RPC during read only inspection. Initial and repeated total request times ranged from about 0.55 to 6 seconds. These samples include network time and do not isolate SQL execution or establish a production p95.

Disposable validation used 5,003 synthetic entries and 40,027 derived terms. Both SQL suites passed. Results and ordering matched migration 17 for 17 representative queries. The direct prefix and complete spelling candidate plans used indexes. Over 50 samples per stage, direct p95 was about 13ms and complete p95 was about 13ms. These are fixture results from local PGlite, not live Supabase measurements. Reports under `outputs/` retain earlier measurements from development as well as the final check.

Browser validation uses the actual component and styles with synthetic API responses. Checks cover 390px, 768px, and 1280px widths, a 640 by 450 viewport equivalent to the available layout area at 200 percent desktop zoom, and short viewports representing keyboard space. Direct matches stay selectable while completion runs. All eight results are reachable by scrolling and keyboard, long text wraps, cached results display immediately, both Escape actions work, retry keeps the list open, French labels fit, and focus returns to the opener. Physical mobile keyboard behavior still needs a device check.

Migration 18 has been validated in a disposable database. It has not been applied to staging or production in this task. No staging database connection or database management access is configured. Apply and measure it in staging before production rollout.

To reverse migration 18, restore only the original `search_dictionary_suggestions()` definition from migration 17, then remove the direct RPC, prefix bound helper, and `dictionary_search_terms_prefix_c_idx`. Retain dictionary records, the term table, and its synchronization trigger. Deploy the earlier app alongside that reversal if the direct stage is being removed.
