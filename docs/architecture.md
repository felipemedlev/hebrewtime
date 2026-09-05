# App architecture

## Overview

HebrewTime is a Next.js 16 App Router application. Episodes load from Supabase at runtime, with a local JSON fallback for legacy intermediate content when Supabase has no rows.

```
Browser → Next.js (Server Components + API routes)
              ↓
         Supabase PostgreSQL (episodes, vocabulary, flashcards)
              ↓
         Supabase Storage (episode audio)
              ↓
         OpenAI (dictionary miss, gloss translation, example phrases, Realtime voice)
```

## Data layer

| File | Role |
|------|------|
| `src/lib/episodes.ts` | Primary episode loader (Supabase, `no-store`; falls back to `pipeline/data/episodes.json`) |
| `src/lib/levelTracks.ts` | Level metadata: finished counts, resume episode, progress |
| `src/lib/progress.ts` | Versioned, guest/account-scoped lesson bookmarks and Hebrew input normalization (`persistLessonBookmark` reports storage success) |
| `src/lib/analytics.ts` | Typed, allowlisted learning events with browser-local deduplication |
| `src/lib/episodeAudio.ts` | Routes audio URLs to `/api/audio` (Google Drive) or `/api/episode-audio/[level]/[id]` |
| `src/lib/episodeTranslations.ts` | Resolves `translations` JSONB for active UI language and reports English paragraph fallback |
| `src/lib/types.ts` | Shared TypeScript types |

### API routes

| Route | Purpose |
|-------|---------|
| `/api/levels` | Available learning tracks (1 hour cache) |
| `/api/episode/[level]/[id]` | Single episode JSON (dynamic, no store) |
| `/api/episode-audio/[level]/[id]` | Supabase Storage audio proxy |
| `/api/audio` | Google Drive audio proxy (host allowlist) |
| `/api/dictionary/suggest` | Dictionary autocomplete |

## Components

| Component | Role |
|-----------|------|
| `AppShell.tsx` | Main layout, view gating, subscription upsell, example phrase orchestration |
| `Sidebar.tsx` | Navigation, search, tab switching |
| `EpisodeViewer.tsx` | Hebrew + translation reading, word click, modals |
| `LearningTrackSelector.tsx` | Level dropdown with progress |
| `LanguageSelector.tsx` | UI language picker |
| `VocabularyView.tsx` | Saved words table/cards, inline edit, FAB to add words |
| `ReviewView.tsx` | Review hub: flashcards, fill in, matching, reverse cards, stats |
| `ReviewStatsView.tsx` | Practice stats dashboard with hero ring, modality cards, weak words, share |
| `StatRing.tsx` | SVG progress ring for stats hero and session recap |
| `SessionRecapScreen.tsx` | Fill-in / matching session complete screen with score ring and share |
| `FlashcardsView.tsx` | FSRS forward card sessions |
| `TranslationModal.tsx` | Compact word translation popup |
| `DictionaryDetailsModal.tsx` | Pealim conjugation tables |
| `ExamplePhrasesPanel.tsx` | Shared example phrase UI |
| `OnboardingOverlay.tsx` | Short first-visit language/track setup, available to guests and returning users from Settings |
| `SpeakView.tsx` | Hebrew speaking practice via OpenAI Realtime (WebRTC) |
| `AdminDashboard.tsx` | `/admin` usage stats and premium management |

## Hooks

| Hook | Role |
|------|------|
| `useVocabulary.ts` | Vocabulary sync to Supabase |
| `useFlashcards.ts` | FSRS review scheduling; session queue picks newest due cards first and deprioritizes cards reviewed in the last 30 minutes |
| `useEntitlements.ts` | Auth/premium/admin status |
| `useFinishedEpisodes.ts` | Per-level finished state (guest/account scoped localStorage + Supabase) and explicit legacy import |
| `useOnboarding.ts` | Guest-first setup visibility, persisted completion, and reopen callback |
| `useUsageTracking.ts` | Active site time for admin stats |
| `useReviewPracticeStats.ts` | Fill-in and matching attempt stats; feeds `reviewStatsSummary` |
| `useModalAccessibility.ts` | Focus trap, Escape, body scroll lock |
| `useSpeakProfile.ts` | Load/save `speak_profiles` (preferences, learner facts, summary) |
| `useSpeakSession.ts` | OpenAI Realtime WebRTC session (`@openai/agents/realtime`) |

## Internationalization

Dependency free client side catalogs in `src/lib/i18n/`.

- `types.ts`: `LangCode` (`en`, `ru`, `es`, `fr`)
- `messages.ts`: all UI strings
- `LanguageProvider.tsx`: `lang`, `setLang`, `t()`, blur toggle

Preference stored in `localStorage` (`hebrewtime-language`) and synced to `user_metadata.preferred_language` when logged in.

Episode translations use `episodes.translations` JSONB (paragraph arrays per language). `english_paragraphs` is kept for backward compatibility. Portuguese and Ukrainian keys are filtered at runtime for old rows, and missing requested paragraphs fall back to English with explicit metadata so the UI can explain the fallback. Existing production translation JSON is left intact.

## Progress and resume behavior

Lesson completion and bookmarks are scoped by the current Supabase user id. Guests use a separate local namespace; changing accounts clears the active in-memory state before loading the new account. A bookmark is versioned (`hebrewtime-bookmarks-v1:<scope>`) and stores level, episode, paragraph index, audio seconds, scroll position, and `updatedAt`. It is written after reading/audio interaction and restored after audio metadata loads without autoplay.

Older unscoped completion data is migrated into the guest namespace only. When an authenticated user has legacy data available, the interface offers a one-time explicit import; it is never silently attached to an account. Failed completion writes roll back the optimistic UI and expose a retryable save error.

## Learning analytics

`src/lib/analytics.ts` wraps the existing page analytics provider. It emits only typed, allowlisted properties: language, track, episode number, modality, and coarse counts. Events cover setup viewed/completed/skipped, lesson started/resumed/completed, successful vocabulary saves, and review started/completed. Lesson start is recorded after a learning interaction (word selection or play), not on page render. First activation is the first completed lesson or completed review session. Return usage means meaningful learning on a later local calendar day. A browser-local key deduplicates first activation and daily return signals; analytics failures are swallowed so learning is never blocked. This is a lightweight measurement layer, so conversion and return rates are available only where the existing browser analytics collector is available and return measurement is device/browser local.

## Dictionary lookup

Order in `src/lib/dictionaryLookup.ts`:

1. Exact headword match on `dictionary_entries.word`
2. Strip up to 3 Hebrew prefixes (ה, ו, ב, כ, ל, מ/מה, ש)
3. Conjugated form match via `forms[].hebrew_plain`
4. Fuzzy match via `pg_trgm` (`match_dictionary_word()` RPC)
5. OpenAI fallback when steps 1–4 find nothing, or to disambiguate homonyms

Dictionary hits return Pealim lemma, Nekudot, transliteration, and meaning. Non English UI languages get gloss translation via a small OpenAI call.

Saved words store `dictionary_pealim_id` when available, enabling conjugation modals later.

### Practice stats summary

[`src/lib/reviewStatsSummary.ts`](../src/lib/reviewStatsSummary.ts) derives dashboard headline metrics client side from `FlashcardStats`, `ReviewPracticeStats`, and practice attempt timestamps (combined 7-day accuracy, practiced today, practice day streak). No extra database queries.

See [`dictionary_entries.md`](dictionary_entries.md) for schema details.

## Lemma rules (vocabulary saves)

- **Nouns** → singular indefinite (e.g. הַנּוֹשֵׂא → `נושא`)
- **Verbs** → infinitive (e.g. מְדַמְיֵן → `לדמיין`)
- Translations omit articles and infinitive markers

## Phrase saves

Users can add **phrases** manually from the vocabulary view (+ button → Phrase tab). They type Hebrew and translation themselves. No Pealim lookup and no OpenAI translation. Stored with `entry_kind = 'phrase'`; `dictionary_pealim_id` stays null.

## Server actions (`src/app/actions.ts`)

| Action | Auth | Notes |
|--------|------|-------|
| `translateWord` | Optional (rate limited) | Pealim first, OpenAI fallback |
| `getDictionaryEntryDetails` | None | Lazy conjugation payload |
| `generateExamplePhrases` | Required | Cached in `vocabulary.example_phrases` |
| `createSpeakSession` | Required | Mints OpenAI Realtime client secret; free tier daily cap reserved atomically |
| Admin/premium actions | Admin only | Grant/revoke premium, usage stats |

Rate limits and input bounds: `src/lib/actionGuards.ts`.

## Speak with AI (Realtime voice)

Fourth sidebar tab (`viewMode: "speak"`). Learners talk to a patient Hebrew teacher over **OpenAI Realtime** (`gpt-realtime-2.1` or cheaper `gpt-realtime-2.1-mini`) using **WebRTC** via `@openai/agents/realtime`. Free conversation: the teacher greets, picks a fresh everyday opening from learner context, then follows the learner — not a café/directions roleplay and not a spark script.

Full spec, session lifecycle, prompts, memory, entitlements, and extension checklists: [`speak.md`](speak.md).

Key files: `src/lib/speak/`, `src/components/SpeakView.tsx`, `src/hooks/useSpeakProfile.ts`, `src/hooks/useSpeakSession.ts`, `src/app/styles/speak.css`.

## Audio synchronization

- **Generated tracks** (Beginner, Intermediate 2, Advanced): sentence level timestamps from Gemini TTS pipeline (`alignment_method: direct_sentence_tts`)
- **Legacy Intermediate**: Whisper alignment via `pipeline/lib/alignment.py` and `pipeline/align_legacy_episode.py`

Frontend highlights current sentence/paragraph in `EpisodeViewer.tsx` based on `hebrew_paragraphs` timing objects.

## Premium and free tier

| User type | Episodes | Translate | Vocabulary | Flashcards | Examples | Speak |
|-----------|----------|-----------|------------|------------|----------|-------|
| Logged out | Yes | Daily limit (localStorage) | No (auth required) | No | No | No (login CTA) |
| Free authenticated | Yes | Daily limit (server) | Yes (capped) | Yes (capped) | Yes (capped) | 1 session/day (~3 min) |
| Premium | Yes | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |
| Admin | Yes | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |

Blocked actions show a sticky subscription upsell panel ($10/month messaging).

## Security notes

- OpenAI actions enforce per requester rate limits in `src/lib/actionGuards.ts`
- Audio proxy `/api/audio` only accepts HTTPS Google Drive URLs
- Supabase Storage audio is streamed via service role only for published episodes and validated positive integer level/episode ids
- Audio proxies validate byte ranges, preserve valid `206` responses, reject malformed ranges, and enforce upstream redirect/content-type/timeout checks
- Dictionary reads use `supabaseAdmin` server side so anonymous translation works
- Realtime speak sessions mint ephemeral keys server-side; microphone allowed only for same-origin (`microphone=(self)`)
- Authenticated translation, examples, fill-in generation, and speaking use atomic service-role quota reservations in migration 16. Reservations fail closed on quota-store errors and are released only after confirmed upstream failures; uncertain outcomes remain counted.
- Flashcard and review-attempt RLS requires ownership of the referenced vocabulary row as well as the submitted user id.
- The in-memory limiter is bounded/pruned per process. Anonymous limits remain process-local, and the speaking duration timer remains client-enforced; distributed limits and authoritative call termination require separate infrastructure.

## Onboarding

The first visit opens a compact setup overlay for guests and authenticated users. It offers UI language and a published learning track (Beginner is the default when available), explains a one-paragraph read/listen action, and provides Skip plus guest reading. Completion is stored locally for guests and in `user_metadata.onboarded` for signed-in users. A Settings button in navigation reopens setup. Signup with no returned session explains that email confirmation is required before continuing.

## Password recovery

"Forgot password" in `AuthModal` → Supabase email → `/update-password` sets new password after recovery session init.

## Styling

Vanilla CSS split under `src/app/styles/`, imported via `globals.css`. No CSS framework.

## Verification and rollout

The focused unit suite covers resume selection, fallback translation resolution, Hebrew normalization, retired language filtering, malformed action inputs, analytics deduplication, and level-track progress helpers. Run `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev`, and the Python translation-configuration check before release. Apply and verify `supabase/migrations/16_security_and_atomic_usage.sql` in staging before deploying the application changes; existing migrations 01–15 remain unchanged.

Manual checks should include guest and authenticated flows at 390, 768, and 1280px, 200% zoom, keyboard and reduced-motion navigation, long French/Russian labels, mixed Hebrew/English content, published/unpublished audio, range requests, and microphone/device behavior. Production migration, real-account recovery, and device checks remain explicit rollout steps.
