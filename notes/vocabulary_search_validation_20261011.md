# Vocabulary search validation

Date: October 11, 2026. Source of truth: application code and disposable synthetic dictionary fixtures. No customer vocabulary was exported or changed.

## Files changed

The vocabulary modal, popup CSS, search endpoint, shared search helpers, modal focus hook, and translations implement floating results and two search stages. Migration 18 adds the direct database function and improves the existing complete function. New unit tests, SQL fixtures, and a saved validation script cover these changes. README and architecture, database, and search documentation describe rollout.

## Checks run

* `npm test`: 83 tests passed across 19 files.
* `npm run lint`: passed with no warnings.
* `npm run build`: passed after allowing the existing Google Fonts requests.
* `git diff --check`: passed.
* Disposable SQL validation applied migrations 06, 17, and 18. Migration 18 was applied twice to test idempotence. Both SQL fixture suites passed and rolled back their fixtures.
* Complete results and ranking matched migration 17 for 17 representative queries. Direct results matched the normal portion of those lists.
* Prefix and spelling candidate plans used their indexes. The complete candidate query was inspected, including the length and entry filters.

## Latest measurement

Output: `outputs/dictionary_search_validation_2026-10-11T07_30_15_025Z.json`.

Grain: one result per Pealim entry. The fixture database contained 5,003 synthetic dictionary entries and 40,027 derived search terms. Each stage was measured over 50 SQL calls across five query examples, with the database already populated and analyzed. These measurements exclude HTTP, network, client debounce, and rendering time.

| Stage | p50 | p95 |
| :--- | ---: | ---: |
| Direct | 1.00ms | 12.63ms |
| Complete | 1.49ms | 12.89ms |

Older dated reports are retained. They include measurements before the final indexed candidate ordering, when complete search p95 was above 400ms. The final query prevents the planner from applying poorly estimated length filters before the GIN candidate lookup.

## Browser checks

The temporary preview bundled the actual modal, language provider, focus hook, and application CSS. Synthetic responses provided two normal matches after 60ms, then eight complete results after three seconds. A separate query returned a completion error. This made the intermediate and failure states visible without touching real vocabulary or using AI.

Verified widths: 390, 768, and 1280 CSS pixels. A 640 by 450 viewport represents the layout space of a 1280 by 900 desktop at 200 percent zoom. A 390 by 320 viewport represents reduced space while a keyboard is open. These are viewport simulations, not a physical device test.

Checks included popup overflow beyond the card, viewport margins, wrapping of long Hebrew words and pronunciation, full English meanings, French labels, all eight options reachable through keyboard scrolling, active selection preserved after completion, Enter selection, immediate cached results, completion errors retaining normal results, retry retaining focus and the list, two Escape actions, and focus restoration to the opener.

Screenshot: `outputs/vocabulary_search_mobile_20261011.jpg`. It shows the actual component with synthetic results at 390 by 844 pixels.

## Assumptions and remaining rollout

The final list retains the existing ranking and matching features. Suggestions keep English meanings; translation after selection is unchanged. Rate limits remain unchanged and apply to both stages.

Migration 18 was validated locally but has not been applied to staging or production. No staging database connection or database management access is configured. Next steps are to apply migration 18 in staging, confirm index usage and the live 250ms database p95 target, check a real mobile keyboard, and then apply the migration before deploying the app in production. No commit was created.
