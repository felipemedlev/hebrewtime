# Retention and reliability changes

This document records the behavior shipped with the retention and reliability pass. It is implementation evidence and rollout guidance, not a claim about measured churn causes. The hypotheses came from the existing reader, hooks, routes, and storage behavior; production funnel data was not available in this repository.

## User-facing behavior

- The reader restores the most recent lesson and paragraph for the current guest or Supabase account. Audio position and scroll position are stored in a versioned bookmark and restored after audio metadata loads without autoplay.
- Episode identity, content, and bookmark are committed together only after a request succeeds. A superseded request is ignored, and a failed navigation keeps the current lesson visible with a retry action.
- Completion data is isolated by guest/account namespace. Old unscoped completion data is imported into the guest namespace; an authenticated user gets an explicit one-time legacy import action instead of silent attachment.
- The first visit offers a short language and published-track setup. Guests can read immediately, authenticated users retain the selected lesson through signup, and Settings can reopen setup. The overlay points to one paragraph of reading/listening rather than a feature tour.
- Completing a lesson exposes the next useful action: resume reading, review due vocabulary, continue to the next unfinished episode, or see an honest finished-track state. Review includes a five-card quick session using the existing FSRS ordering and the standard session remains available.
- Empty vocabulary and review states include a direct “Start reading” action so a new learner can reach the first useful interaction without guessing which navigation tab to use.
- Hebrew passages and inputs use `lang="he"` and RTL direction while the shell remains LTR. Paragraphs provide one tab stop with documented arrow-key word movement; Enter, Space, and pointer selection continue to work. Mobile navigation is a focus-managed drawer with Escape dismissal and focus restoration.

## Storage and migration rules

| Data | Current storage | Migration rule |
|------|-----------------|----------------|
| Lesson bookmark | `localStorage` key `hebrewtime-bookmarks-v1:<guest\|user-id>` | Invalid or old records are ignored. The key is versioned so future schema changes can migrate deliberately. |
| Guest completion | `localStorage` key `hebrewtime-finished-episodes:guest` | Legacy `finished-episodes` data is copied once to the guest namespace. |
| Account completion | `finished_episodes` rows filtered by `user_id` | Account changes clear active state before loading the new user. Legacy unscoped data is never automatically assigned to an account; the UI offers an explicit import. |
| Language preference | `localStorage` plus `user_metadata.preferred_language` | Portuguese and Ukrainian values normalize to English. |
| Old episode translation JSON | Existing `episodes.translations` rows | Runtime filters retired `pt`/`uk` keys and falls back paragraph-by-paragraph to English. Existing production JSON is not rewritten. |

Migration 16 adds the atomic daily-usage RPCs and ownership policies. Apply it in staging, verify it, and then deploy the dependent application code. No existing learning tables or routes are replaced.

## Supported languages

The UI and AI-language mapping support English, Russian, Spanish, and French (`en`, `ru`, `es`, `fr`). Hebrew remains the source learning language. Portuguese and Ukrainian catalogs, selectors, generation defaults, and committed intermediate script translations were removed; legacy production translation keys are filtered at runtime.

## Measurement

`src/lib/analytics.ts` emits typed, allowlisted events through the existing page analytics provider:

- Setup: `setup_viewed`, `setup_completed`, `setup_skipped`
- Learning: `lesson_started`, `lesson_resumed`, `lesson_completed`, `vocabulary_saved`
- Review: `review_started`, `review_completed`

Activation is the first completed lesson or completed review session. Return usage is meaningful learning on a later local calendar day. Lesson starts are sent after a word selection or audio play, rather than on page render. First activation and daily return signals are deduplicated in browser-local storage. Only language, track, episode, modality, and coarse counts are sent; identities, tokens, Hebrew text, transcripts, and learner facts are excluded. Analytics failures are swallowed. Collection and return measurement therefore depend on the existing browser analytics collector and the same browser/device.

## Security findings and fixes

### High priority

- Next.js was upgraded from 16.2.6 to 16.3.4 with the matching ESLint configuration. The production dependency audit now reports zero vulnerabilities. The upgrade addresses the maintainer advisory affecting Server Actions in this architecture.

### Medium priority

- Authenticated translation, examples, fill-in generation, and speaking now reserve the existing daily counters through atomic, service-role-only Supabase functions. Reservations fail closed on store errors and are released only after confirmed upstream failure; uncertain upstream outcomes remain counted.
- Privileged Supabase Storage audio requires a published episode and validates the level, positive integer id, and byte range. Audio proxies preserve valid `206` responses and reject malformed ranges, redirects, unexpected content types, and upstream timeouts.
- Flashcard and review-attempt write policies require ownership of the referenced vocabulary row in addition to the submitted user id.
- Completion state and request results are account-scoped and stale requests are discarded, preventing cross-account browser contamination.

### Hardening and limitations

- Server actions validate and bound payloads and AI responses. User-provided prompt material is escaped and delimited as untrusted data. In-memory rate limiting is bounded and pruned, with upstream timeouts and sanitized user-facing failures.
- CSP remains report-only until production compatibility is verified. Anonymous quotas are process-local, and speaking duration is still client-enforced; distributed anonymous limits or authoritative call termination require an infrastructure decision.
- Secret checks were run against tracked files/history with redacted output. No credentials were printed, rotated, or overwritten.

## Verification and rollout status

The repository checks completed after implementation:

- `npm test` — 30 focused tests passed across 10 files.
- `npm run lint` — passed with the project configuration.
- `npm run build` — passed; the build tolerates unavailable Supabase during static generation and uses the documented local fallback.
- `npm audit --omit=dev` and `npm audit` — zero vulnerabilities reported.
- Python translation configuration check — passed with `ru`, `es`, and `fr`.
- `git diff --check` — passed.

Browser/device journeys, staging SQL execution, real-account recovery, and microphone checks remain manual rollout steps. Verify guest and authenticated flows at 390, 768, and 1280px, 200% zoom, keyboard/reduced-motion settings, long French/Russian labels, mixed Hebrew content, published/unpublished audio, and range responses before production release.
