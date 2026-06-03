# HebrewTime

HebrewTime is a beautiful, bilingual web-based reader for the Hebrew Time podcast. It provides an elegant Notion/Apple-like reading experience with side-by-side Hebrew and English paragraphs.

The application allows intermediate Hebrew learners to read podcast transcripts and click on any word to get a contextual, AI-powered translation (complete with Nekudot) and save it to their personal vocabulary list. Premium users can also generate AI example sentences for saved words to see everyday usage in context. Since word translation and example-phrase generation use OpenAI credits, translation, vocabulary, and flashcards are gated behind a premium subscription prompt shown in-app at $10/month.

## Key Features

- **Bilingual Interface**: Smooth side-by-side Hebrew and English paragraphs.
- **Audio-Synchronized Highlighting**: As the podcast audio plays, the current Hebrew paragraph is automatically highlighted and smoothly scrolled into view, allowing learners to easily follow along. This is powered by high-performance custom DOM events that sync the UI at 60fps without heavy React re-renders. Note: Currently, only episodes that have been processed with the Whisper timestamp synchronization script (e.g., Episode 1) will feature this highlighting.
- **Focus Mode for Hebrew Reading**: A top-bar toggle lets users blur all English transcript text on demand, so learners can practice Hebrew-first reading. The preference is saved in local storage.
- **Mark Episodes as Finished**: Users can mark episodes they've completed. This state is synced to the Supabase database for authenticated users (and stored in local storage) and represented by a green checkmark in the sidebar and an elegant button at the end of the episode text.
- **Scroll Position Persistence**: The application remembers your exact scroll position when switching between episodes, the vocabulary list, and flashcards, so you never lose your place.
- **Premium-gated AI Translation**: Click any Hebrew word to translate it within the context of the sentence using OpenAI (gpt-5.4-mini). A specially tuned prompt ensures:
  - 100% grammatically correct Nekudot vocalization based on the exact contextual meaning.
  - The stored word is always the **base dictionary form (lemma)** — prefixes like ה (the), ל (to), ב (in), מ (from), ו (and), כ (as) are automatically stripped.
  - For nouns: the singular indefinite form is saved (e.g., נושא, not הנושא).
  - For verbs: the infinitive form is saved (e.g., לדמיין, not מדמיין or מְדַמְיְנִים).
  - Translations omit articles: "topic" not "the topic", "imagine" not "to imagine".
  - Lemma accuracy is cross-validated against pealim.com in the AI prompt.
  - This is available only to premium users.
- **Premium Vocabulary Manager & Auth**: Users can create an account via Supabase Email Auth (including “Forgot password” recovery). Premium users can save synced vocabulary in Supabase PostgreSQL across devices.
  - Rendered in an elegant, minimal Apple/Notion-style data table on desktop and card layout on mobile. Desktop column order: **Source** (leftmost) → Pronunc. → Translation → Verb form → **Hebrew** (rightmost, for natural RTL reading) → Actions.
  - Supports inline editing of saved words directly on the vocabulary page (Hebrew with Nekudot, verb form, translation, and pronunciation). Pressing **Enter** in any edit field saves the row (same as clicking the ✓ button).
  - On mobile, the Hebrew word is right-aligned and actions sit on the left, preserving the RTL-natural reading flow in a card layout.
  - **Dynamic Search & Filtering**: A responsive search bar instantly filters your vocabulary list as you type. It works seamlessly for English translations, Hebrew words (even without typing specific Nekudot), and pronunciation.
  - Smart deduplication logic allows saving the exact same Hebrew word multiple times if its contextual meaning (translation) or pronunciation (Nekudot) differs.
  - **AI Example Phrases**: Each saved word can reveal 3 AI-generated example sentences (Hebrew with Nekudot + English translation) showing everyday usage. Phrases are **not** generated at save-time — the user expands an “Examples” panel (Vocabulary tab) or taps “Show examples” (Flashcards) to trigger generation on first use. Results are cached in `vocabulary.example_phrases` (JSONB) per user per word and load instantly on subsequent views. Any single phrase can be regenerated unlimited times via a per-phrase refresh button. Shared UI lives in `ExamplePhrasesPanel.tsx`; orchestration in `AppShell.tsx` calls `generateExamplePhrases` then persists via `useVocabulary.updateWord`.
- **Top-of-Screen Subscription Upsell (Apple/Notion Style)**: If a non-premium user clicks the Vocabulary tab, Flashcards tab, or tries to translate a word, the app shows a large sticky promo panel with $10/month messaging and a CTA that opens auth/signup.
- **Spaced Repetition Flashcard System (FSRS)**: An elegant, built-in flashcard system designed to help users master their saved vocabulary.
  - **FSRS Scheduling** ([ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)): Uses the Free Spaced Repetition Scheduler with 90% target retention, predicting memory stability and difficulty per card. Due cards load dynamically (up to 20 per session).
  - **Compact Review Stats Strip**: Shows Due, New, Learning, Learned, Reviewed Today, Avg Recall (FSRS retrievability), Next Review ETA (when caught up), and Mastery progress in a low-height summary strip. On mobile, the stats become a horizontal scroll strip so the main flashcard/review area stays high on the screen.
  - **Clean Review Navigation**: The Review tab no longer shows an overlaid due-count badge; due counts remain available in the sidebar context text and the compact stats strip.
  - **Snappy Anki-Style Card Transitions**: Utilizes React's key diffing pattern (`key={currentIndex}`) to unmount the rated card and mount the new card instantly on its front face. This completely prevents visual flip-back anomalies or mid-flip text replacement lag.
  - **Optimistic background syncs**: Rating actions are handled in the background asynchronously, making card swaps instantaneous and non-blocking.
  - **Example Phrases During Review**: Before or after flipping a card, users can tap “Show examples” to reveal a panel below the card (outside the 3D flip area). On first use, phrases are AI-generated and cached; later sessions read them from the database with zero extra fetch. Each phrase has an unlimited per-slot regenerate button. The examples panel resets when advancing to the next card.
- **Admin Premium Controls**: Admin users can grant/revoke premium access by email from an in-app admin modal. When premium access is granted, the system automatically sends a Supabase invite email to the user, allowing them to sign up and access their premium features immediately.

- **Precision Audio Player**: Persistent bottom audio player with a fully custom UI built on top of HTML5 `<audio>` for reliable cross-platform playback (supports both direct `.mp3` files and Google Drive fallbacks). Key improvements for mobile:
  - **Large-touch-target seek bar**: The scrub thumb is 28 px on mobile (vs the browser default of ~6 px), making it easy to tap and drag on iPhone without misses.
  - **Custom play/pause and mute controls** with animated press feedback, eliminating the cramped native browser chrome.
  - **Live time display** (elapsed / total) that updates in real-time while scrubbing.
  - **Responsive layout integration**: The player seamlessly aligns with the main content area, automatically syncing its width and animations with the sidebar to avoid overlap on desktop.
- **Responsive Workspace**: Features a highly performant, draggable sidebar that lets users seamlessly expand or contract their reading workspace. The custom width bridges native DOM events to CSS variables for 60fps adjustments without heavy React re-renders, smoothly syncing with the bottom media player layout and persisting width preferences via local storage. It also includes an elegant slide-out sidebar for mobile devices, incorporating robust scroll-bleed prevention by utilizing `overscroll-behavior: none` alongside dynamic `pointer-events: none` isolation to mathematically guarantee iOS Safari cannot chain-scroll the background.
- **Automated Scraping**: Python script to scrape episode transcripts from Squarespace and auto-translate missing English sections via OpenAI.

## Architecture & Tech Stack

This project is built with **Next.js 16** (App Router) and **React 19**, focusing on performance and clean component design.

### Tech Stack
- **Framework**: Next.js 16
- **Styling**: Vanilla CSS split under `src/app/styles/` (imported via `globals.css`) for a clean, dependency-free aesthetic.
- **Icons**: `lucide-react`
- **Database & Auth**: Supabase (PostgreSQL) and `@supabase/supabase-js`.
- **Data Fetching/AI**: OpenAI API (`gpt-5.4-mini`) for on-the-fly contextual word translations and lazy-generated example phrases (both premium-only).
- **Scraper**: Python 3 (`requests`, `beautifulsoup4`, `openai`).

### Core Architecture
Following a recent refactor, the app utilizes Next.js Server Components and dynamic API routes for optimal performance:

- **Server-Side Data Layer (`src/lib/episodes.ts`)**: Loads the 1.4MB `episodes.json` dataset directly from the filesystem on the server, ensuring the client bundle remains tiny.
- **Dynamic API Routes (`/api/episode/[id]/route.ts`)**: Statically generates all episode endpoints at build time using `generateStaticParams`, eliminating runtime file system reads and providing instant JSON responses when navigating between episodes.
- **Component Breakdown (`src/components/`)**:
  - `AppShell.tsx`: The main responsive client wrapper managing state/layout, view gating, sticky $10/month subscription prompts for blocked premium actions, English blur toggle, and example-phrase orchestration (`generateExamples` / `regenerateExample`).
  - `Sidebar.tsx`: Navigation, search, and tab switching.
  - `EpisodeViewer.tsx`: Bilingual reading experience, word-click handling, and conditional blurring of English transcript text.
  - `VocabularyView.tsx`: Saved words in a desktop table / mobile card layout with search, filtering, inline editing, and expandable example-phrase panels.
  - `FlashcardsView.tsx`: Core spaced-repetition card review view featuring a compact Review stats strip, 3D flip animations, snappy Anki-style deck swaps, and example phrases below the card.
  - `ExamplePhrasesPanel.tsx`: Shared UI for listing, generating, and regenerating example phrases (used by Vocabulary and Flashcards).
  - `TranslationModal.tsx`: The AI translation popup.
  - `AuthModal.tsx`: The Supabase authentication UI for login, sign up, and password recovery.
- **Custom Hooks (`src/hooks/`)**:
  - `useVocabulary.ts`: Manages syncing vocabulary (including `example_phrases`) to Supabase based on the user's login state.
  - `useFlashcards.ts`: Tracks reviews and schedules next card review times via FSRS (`src/lib/fsrs.ts`), syncing flashcard progress state with Supabase.
  - `useEntitlements.ts`: Resolves auth/premium/admin status via server actions for gating translations, vocabulary, flashcards, and example phrases.
  - `useUser.ts`: Subscribes to Supabase auth events to track logged-in users.
  - `useFinishedEpisodes.ts`: Manages the state of read matching in local storage, powering the UI checkmarks across the app.

## Setup & Local Development

### 1. Environment Variables

Create a `.env` file in the root directory. You need an OpenAI API key for translations and example phrases, and Supabase keys for authentication and database support.

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is required for secure server-side premium checks and admin premium management.
- `ADMIN_EMAILS` is a comma-separated list of emails allowed to open the in-app Premium Users admin modal.

### 2. Supabase Database Setup

For vocabulary saving + premium management to work, navigate to your Supabase SQL Editor and execute the following snippet:

```sql
CREATE TABLE IF NOT EXISTS public.vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  word_with_nekudot TEXT,
  verb_form_with_nekudot TEXT,
  translation TEXT NOT NULL,
  pronunciation TEXT,
  episode_title TEXT,
  episode_url TEXT,
  saved_at BIGINT,
  example_phrases JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_premium_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.premium_users pu
    JOIN auth.users u ON lower(u.email) = lower(pu.email)
    WHERE u.id = auth.uid()
      AND pu.is_premium = true
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_premium_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_premium_access() TO authenticated;

CREATE POLICY "Premium users view own vocabulary" ON public.vocabulary FOR SELECT USING (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users insert own vocabulary" ON public.vocabulary FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users update own vocabulary" ON public.vocabulary FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access()) WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users delete own vocabulary" ON public.vocabulary FOR DELETE USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE TABLE IF NOT EXISTS public.flashcard_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vocab_id UUID REFERENCES public.vocabulary(id) ON DELETE CASCADE NOT NULL,
  ease_factor DOUBLE PRECISION DEFAULT 2.5 NOT NULL,
  interval_days INTEGER DEFAULT 0 NOT NULL,
  repetitions INTEGER DEFAULT 0 NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  is_learned BOOLEAN DEFAULT FALSE NOT NULL,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  stability DOUBLE PRECISION,
  difficulty DOUBLE PRECISION,
  state INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, vocab_id)
);
ALTER TABLE public.flashcard_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Premium users view own flashcard progress" ON public.flashcard_progress FOR SELECT USING (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users insert own flashcard progress" ON public.flashcard_progress FOR INSERT WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users update own flashcard progress" ON public.flashcard_progress FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access()) WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
CREATE POLICY "Premium users delete own flashcard progress" ON public.flashcard_progress FOR DELETE USING (auth.uid() = user_id AND public.user_has_premium_access());

CREATE TABLE IF NOT EXISTS public.premium_users (
  email TEXT PRIMARY KEY,
  is_premium BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.premium_users ENABLE ROW LEVEL SECURITY;

-- Only service-role writes are used by the app for this table.
CREATE POLICY "Users can read own premium status"
ON public.premium_users
FOR SELECT
TO authenticated
USING (
  lower(email) = lower((
    SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
  ))
);

CREATE TABLE IF NOT EXISTS public.finished_episodes (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  episode_number INTEGER NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, episode_number)
);
ALTER TABLE public.finished_episodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own finished episodes" ON public.finished_episodes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own finished episodes" ON public.finished_episodes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own finished episodes" ON public.finished_episodes FOR DELETE USING (auth.uid() = user_id);
```

If you already created the `vocabulary` table without example phrases or without an UPDATE policy, run this migration in the Supabase SQL Editor:

```sql
ALTER TABLE public.vocabulary
  ADD COLUMN IF NOT EXISTS example_phrases JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Skip this line if "Premium users update own vocabulary" already exists from a fresh install.
CREATE POLICY "Premium users update own vocabulary" ON public.vocabulary
  FOR UPDATE USING (auth.uid() = user_id AND public.user_has_premium_access())
  WITH CHECK (auth.uid() = user_id AND public.user_has_premium_access());
```

If you created the database before premium-aware RLS was added, run the full migration in [`supabase/premium-rls-migration.sql`](supabase/premium-rls-migration.sql). It replaces the older auth-only vocabulary/flashcard policies, adds `user_has_premium_access()`, and restricts `premium_users` reads to each user's own row.

If you created `flashcard_progress` before FSRS columns were added, run [`supabase/fsrs-migration.sql`](supabase/fsrs-migration.sql) in the Supabase SQL Editor. Existing SM-2 rows are migrated automatically on the next review in the app.

**Admin note:** `ADMIN_EMAILS` unlocks premium features in server actions and the UI, but vocabulary/flashcard writes are enforced in Postgres via `premium_users`. Grant admin accounts a row in `premium_users` (via the admin panel or a one-time `INSERT`) so they can save vocabulary.

Optional helper trigger (keeps `updated_at` current on updates):

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS premium_users_set_updated_at ON public.premium_users;
CREATE TRIGGER premium_users_set_updated_at
BEFORE UPDATE ON public.premium_users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
```

### 3. Premium Access Rules

- **Non-authenticated users**: cannot use word translation, vocabulary, or flashcards.
- **Authenticated non-premium users**: can read episodes, but translation, vocabulary, flashcards, and example-phrase generation are blocked.
- **Blocked action UX**: when non-premium users try to open Vocabulary, open Flashcards, or translate a word, they see a sticky top-of-screen subscription panel advertising **$10/month** and can open auth/signup from the CTA.
- **Premium users**: can translate words, generate example phrases (OpenAI usage), and access vocabulary and flashcards normally.
- **Admin users** (`ADMIN_EMAILS`): automatically get premium access in server actions and the UI, and they can open the admin modal to grant/revoke premium access for other users by email. Granting premium access automatically triggers a Supabase invite email to the recipient. Admin accounts also need a row in `premium_users` to pass database RLS for vocabulary/flashcard writes.

**Security notes:**
- OpenAI server actions (`translateWord`, `generateExamplePhrases`) enforce auth/premium checks, per-user rate limits, and input length bounds in `src/lib/actionGuards.ts`.
- The audio proxy at `/api/audio` only accepts HTTPS Google Drive URLs (`src/lib/allowedAudioHosts.ts`); all other hosts are rejected.

### 4. Updating Episodes (Python Scraper)

To fetch the latest podcast transcripts and auto-translate them to English:

```bash
# Ensure you have your .env setup with OPENAI_API_KEY
pip install requests beautifulsoup4 openai python-dotenv
python scraper.py
```
This generates/updates `episodes.json` (used by the Next.js app). `episodes_checkpoint.json` is optional and is used only by the scraper/maintenance scripts for resume support.

#### Important: Missing transcript paragraphs (leading text outside `<p>` tags)
Squarespace sometimes renders parts of the transcript (especially the opening paragraph, or text immediately following an image block) as leading text nodes before the first `<p>` tag inside its containing layout block. Older runs of the scraper missed these paragraphs (and downstream UI would appear to skip them).

- `scraper.py` was updated to iterate over all layout blocks, correctly extracting these leading text nodes and inserting them into the paragraph sequence in the proper order.
- If you already have an older `episodes.json` missing these paragraphs, you can patch it efficiently by discovering and translating only the missing paragraph(s) using difflib:

```bash
python3 apply_scraping_patch.py
```

The script:
- compares the re-scraped Hebrew text with the old JSON data to find exact insertions.
- translates only the missing middle/prefix paragraphs via OpenAI.
- updates `hebrew_paragraphs`, `english_paragraphs`, and `hebrew_text`.
- creates a backup at `episodes.json.bak.<timestamp>`.

(Note: `patch_missing_transcripts.py` was an older script built only for initial-paragraph prefixes, while `apply_scraping_patch.py` handles missing paragraphs anywhere in the text).

#### Fixing audio URLs (`patch_audio.py`)

If episodes are missing `audio_url` values or still use old Google Drive `/file/d/.../view` links that fail in the browser, run:

```bash
python patch_audio.py
```

The script normalizes Google Drive URLs to direct-download form and can re-fetch missing audio links from Squarespace. It writes `episodes.json` (or `episodes_checkpoint.json` if present).

### 5. Transcript Audio Synchronization (Whisper)

A dedicated script allows generating precise `start` and `end` timestamps for each Hebrew paragraph, enabling the real-time UI highlighting feature:

```bash
python scripts/sync_episode_1.py
```

The script:
- Downloads the original audio file.
- Transcribes the audio using OpenAI's `whisper-1` model with segment-level timestamp granularities.
- Uses sequence matching to align the Whisper segments back to the exact, original `hebrew_paragraphs` (without altering the original text).
- Replaces the string paragraphs in `episodes.json` with timestamp objects: `{ text: "...", start: 0.0, end: 5.5 }`.

*Currently, this script is configured as a test specifically for Episode 1.*

### 6. Password Recovery (Forgot Password)
Password reset is implemented using Supabase Email Auth:

- The “Forgot password?” button in `AuthModal` calls `supabase.auth.resetPasswordForEmail(...)`.
- The reset email redirects the user to `/update-password`.
- `/src/app/update-password/page.tsx` sets the new password via `supabase.auth.updateUser(...)` after Supabase initializes a recovery session from the URL (checked via `supabase.auth.getSession()`).

Make sure your Supabase Auth settings allow redirects back to your site, especially `http://localhost:3000/update-password` for local development and your production domain for deployment.

Note: in this repo’s current `@supabase/supabase-js`/`@supabase/auth-js` version, the typed `verifyOtp({ type: 'recovery' ... })` flow requires an `email`, so we rely on the recovery redirect session initialization instead.

### 7. Vocabulary Word Saving — Lemma Rules

When a user saves a Hebrew word, the app always stores the **base dictionary form (lemma)**, not the surface form that appeared in the text. This is enforced by the OpenAI prompt in `src/app/actions.ts → translateWord`.

**Prefix stripping** — the following prefixes are removed before saving:

| Prefix | Meaning |
|--------|---------|
| ה | the (definite article) |
| ל | to (preposition) |
| ב | in (preposition) |
| מ / מה | from (preposition) |
| ו | and (conjunction) |
| כ | as / like (preposition) |
| ש | that / which (conjunction) |

**Lemma rules:**
- **Nouns** → singular indefinite form. Example: הַנּוֹשֵׂא → `נושא`
- **Verbs** → infinitive form. Example: מְדַמְיֵן or מְדַמְיְנִים → `לדמיין`
- No conjugations, no gendered/plural forms, no pronoun-based translations.

**Translation rules:**
- No "the" for nouns: `נושא` = "topic" not "the topic"
- No "to" for verbs: `לדמיין` = "imagine" not "to imagine"

**OpenAI response contract** (`translateWord` returns 4 fields):
1. `lemmaWord` — base lemma without prefixes and without nekudot (stored in `vocabulary.word`)
2. `translation` — base English meaning only
3. `wordWithNekudot` — base lemma with 100% accurate nekudot (stored in `vocabulary.word_with_nekudot`)
4. `verbFormWithNekudot` — infinitive with nekudot if verb, otherwise `null`

In `EpisodeViewer.tsx`, `modal.lemmaWord` (from the API response) is used as the `word` field when calling `addWord`, so the raw prefixed surface form is **never** persisted to Supabase.

### 8. AI Example Phrases

Premium users can generate contextual example sentences for any saved vocabulary word. Phrases help learners see how a word is used in everyday Hebrew beyond the original episode context.

**Storage model:**
- Stored as a JSONB array on the `vocabulary` row: `example_phrases` (default `[]`).
- App type: `ExamplePhrase = { hebrew: string; english: string }` on `VocabWord.examplePhrases`.
- Loaded in the same `select("*")` query as the rest of vocabulary — no separate table or extra round-trip.
- Scoped per-user automatically because vocabulary rows are user-owned via RLS.

**Generation flow (lazy, then cached):**
1. User opens examples (Vocabulary: MessageSquare toggle on a row; Flashcards: “Show examples” button).
2. If `examplePhrases` is empty, `AppShell.generateExamples` calls the server action, then `useVocabulary.updateWord` persists the result optimistically.
3. If phrases already exist, they render immediately from in-memory `vocabWords` state (shared by Vocabulary and Flashcards via `useFlashcards(vocabWords)`).
4. Regenerating one phrase: `AppShell.regenerateExample` calls the action with `count: 1` and passes existing phrases so the model avoids duplicates, then splices the new phrase at that index and saves.

**Server action** (`src/app/actions.ts → generateExamplePhrases`):
- Signature: `generateExamplePhrases(accessToken, word, translation, count, existingPhrases?)`
- Same premium/auth guard as `translateWord` via `getUserEntitlements`.
- Model: `gpt-5.4-mini`, `response_format: { type: "json_object" }`, `temperature: 0.7`.
- Returns `{ phrases: ExamplePhrase[], type: "success" | "auth_required" | "premium_required" | "error" }`.
- Prompt asks for natural intermediate-level sentences with full Nekudot; inflected/conjugated forms of the target word are allowed.

**UI components:**
- `ExamplePhrasesPanel.tsx` — shared list/generate/regenerate UI.
- `VocabularyView.tsx` — expandable panel under desktop table rows / inside mobile cards.
- `FlashcardsView.tsx` — panel below the flip card (not inside it, to preserve 3D flip); resets on card advance.

**Cost/latency notes:**
- One OpenAI call to generate all 3 phrases; one call per single-phrase regeneration (unlimited).
- Phrases are never auto-generated on word save (avoids credits on words the user never reviews).

### 9. Running the Next.js App

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## File Structure Highlights

- `/scraper.py` - Core scraping and paragraph translation logic.
- `/scripts/sync_episode_1.py` - OpenAI Whisper audio-transcript synchronization tool (Episode 1 test).
- `apply_scraping_patch.py` - Efficiently patches `episodes.json` (translating only missing paragraph(s) anywhere in the text).
- `/episodes.json` - The generated dataset used by the web application.
- `/src/app/page.tsx` - The main server-rendered entrypoint.
- `/src/app/actions.ts` - Server actions for premium checks, admin premium management, `translateWord`, and `generateExamplePhrases` (OpenAI).
- `/src/app/update-password/page.tsx` - Password reset callback (recovery redirect session via `getSession()`, then `updateUser()`).
- `/src/app/api/audio/route.ts` - Google Drive-only audio proxy with host allowlist (bypasses Drive streaming restrictions).
- `/src/lib/actionGuards.ts` - Input bounds and in-memory rate limiting for OpenAI server actions.
- `/src/lib/allowedAudioHosts.ts` - HTTPS allowlist used by the audio proxy.
- `/supabase/premium-rls-migration.sql` - Premium-aware RLS migration for existing Supabase projects.
- `/patch_audio.py` - Normalizes/fixes episode `audio_url` values in `episodes.json`.
- `/src/components/MediaPlayer.tsx` - Custom bottom audio player with large-touch-target seek bar for mobile.
- `/src/components/AdminPremiumModal.tsx` - Admin-only UI to grant/revoke premium by email.
- `/src/components/ExamplePhrasesPanel.tsx` - Shared UI for AI-generated example phrase lists (Vocabulary + Flashcards).
- `/src/lib/fsrs.ts` - FSRS scheduler wrapper (ts-fsrs) for review intervals and retrievability stats.
- `/supabase/fsrs-migration.sql` - Adds FSRS columns to `flashcard_progress` for existing Supabase projects.
- `/src/lib/types.ts` - Shared TypeScript types including `VocabWord`, `ExamplePhrase`, and flashcard types.
- `/src/app/globals.css` - Entry point that imports modular stylesheets from `/src/app/styles/`.
- `/src/app/styles/` - Split design system: `base.css`, `sidebar.css`, `layout.css`, `vocabulary.css`, `modals.css`, `media-player.css`, `flashcards.css`, `example-phrases.css`, and related partials.
