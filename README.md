# HebrewTime

HebrewTime is a beautiful, bilingual web-based reader for the Hebrew Time podcast. It provides an elegant Notion/Apple-like reading experience with side-by-side Hebrew and English paragraphs.

The application allows intermediate Hebrew learners to read podcast transcripts and click on any word to get a contextual, AI-powered translation (complete with Nekudot) and save it to their personal vocabulary list. Since word translation uses OpenAI credits, translation + vocabulary access are gated behind a premium subscription prompt shown in-app at $10/month.

## 🚀 Key Features

- **Bilingual Interface**: Smooth side-by-side Hebrew and English paragraphs.
- **Focus Mode for Hebrew Reading**: A top-bar toggle lets users blur all English transcript text on demand, so learners can practice Hebrew-first reading. The preference is saved in local storage.
- **Premium-gated AI Translation**: Click any Hebrew word to translate it within the context of the sentence using OpenAI (GPT-4o-mini). Includes complete Nekudot vocalization. This is available only to premium users.
- **Premium Vocabulary Manager & Auth**: Users can create an account via Supabase Email Auth (including “Forgot password” recovery). Premium users can save synced vocabulary in Supabase PostgreSQL across devices.
- **Top-of-Screen Subscription Upsell (Apple/Notion Style)**: If a non-premium user clicks the Vocabulary tab or selects a word, the app shows a large sticky promo panel with $10/month messaging and a CTA that opens auth/signup.
- **Admin Premium Controls**: Admin users can grant/revoke premium access by email from an in-app admin modal.
- **Native Audio Player**: Persistent bottom audio player utilizing HTML5 `<audio>` for seamless listening, scrubbing, and pausing (supports both direct `.mp3` files and Google Drive fallbacks).
- **Responsive Design**: Elegant slide-out sidebar for mobile devices.
- **Automated Scraping**: Python script to scrape episode transcripts from Squarespace and auto-translate missing English sections via OpenAI.

## 🏗 Architecture & Tech Stack

This project is built with **Next.js 16** (App Router) and **React 19**, focusing on performance and clean component design.

### Tech Stack
- **Framework**: Next.js 16
- **Styling**: Vanilla CSS (`globals.css`) for a clean, dependency-free aesthetic.
- **Icons**: `lucide-react`
- **Database & Auth**: Supabase (PostgreSQL) and `@supabase/supabase-js`.
- **Data Fetching/AI**: OpenAI API for on-the-fly contextual word translations (premium-only).
- **Scraper**: Python 3 (`requests`, `beautifulsoup4`, `openai`).

### Core Architecture
Following a recent refactor, the app utilizes Next.js Server Components and dynamic API routes for optimal performance:

- **Server-Side Data Layer (`src/lib/episodes.ts`)**: Loads the 1.4MB `episodes.json` dataset directly from the filesystem on the server, ensuring the client bundle remains tiny.
- **Dynamic API Routes (`/api/episode/[id]/route.ts`)**: Client fetches full episode data on demand when navigating between episodes.
- **Component Breakdown (`src/components/`)**:
  - `AppShell.tsx`: The main responsive client wrapper managing state/layout, view gating, sticky $10/month subscription prompts for blocked premium actions, and the English blur toggle state.
  - `Sidebar.tsx`: Navigation, search, and tab switching.
  - `EpisodeViewer.tsx`: Bilingual reading experience, word-click handling, and conditional blurring of English transcript text.
  - `VocabularyView.tsx`: Displays saved words in a grid.
  - `TranslationModal.tsx`: The AI translation popup.
  - `AuthModal.tsx`: The Supabase authentication UI for login, sign up, and password recovery.
- **Custom Hooks (`src/hooks/`)**: 
  - `useVocabulary.ts`: Manages syncing vocabulary to Supabase based on the user's login state.
  - `useUser.ts`: Subscribes to Supabase auth events to track logged-in users.

## 🛠 Setup & Local Development

### 1. Environment Variables

Create a `.env` file in the root directory. You need an OpenAI API key for translations, and Supabase keys for authentication and database support.

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
  translation TEXT NOT NULL,
  episode_title TEXT,
  episode_url TEXT,
  saved_at BIGINT
);
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own vocabulary" ON public.vocabulary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own vocabulary" ON public.vocabulary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own vocabulary" ON public.vocabulary FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.premium_users (
  email TEXT PRIMARY KEY,
  is_premium BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.premium_users ENABLE ROW LEVEL SECURITY;

-- Only service-role writes are used by the app for this table.
CREATE POLICY "Authenticated users can read premium rows"
ON public.premium_users
FOR SELECT
TO authenticated
USING (true);
```

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

- **Non-authenticated users**: cannot use word translation or vocabulary.
- **Authenticated non-premium users**: can read episodes, but translation and vocabulary are blocked.
- **Blocked action UX**: when non-premium users try to open Vocabulary or translate a word, they see a sticky top-of-screen subscription panel advertising **$10/month** and can open auth/signup from the CTA.
- **Premium users**: can translate words (OpenAI usage) and access vocabulary normally.
- **Admin users** (`ADMIN_EMAILS`): can open the admin modal and grant/revoke premium by email.

### 4. Updating Episodes (Python Scraper)

To fetch the latest podcast transcripts and auto-translate them to English:

```bash
# Ensure you have your .env setup with OPENAI_API_KEY
pip install requests beautifulsoup4 openai python-dotenv
python scraper.py
```
This generates/updates `episodes.json` (used by the Next.js app). `episodes_checkpoint.json` is optional and is used only by the scraper/maintenance scripts for resume support.

#### Important: Missing first transcript paragraph
Squarespace sometimes renders the opening part of the transcript as leading text nodes before the first `<p>`. Older runs of the scraper could therefore miss the first paragraph (and downstream UI would appear to “skip” it).

- `scraper.py` was updated to extract those leading text nodes and prepend them as the first Hebrew paragraph.
- If you already have an older `episodes.json`, you can patch it efficiently by translating only the missing paragraph(s):

```bash
python3 patch_missing_transcripts.py --translate --apply
```

The script:
- updates `hebrew_paragraphs`, `english_paragraphs`, and `hebrew_text`
- creates a backup at `episodes.json.bak.<timestamp>`

### 5. Password Recovery (Forgot Password)
Password reset is implemented using Supabase Email Auth:

- The “Forgot password?” button in `AuthModal` calls `supabase.auth.resetPasswordForEmail(...)`.
- The reset email redirects the user to `/update-password`.
- `/src/app/update-password/page.tsx` sets the new password via `supabase.auth.updateUser(...)` after Supabase initializes a recovery session from the URL (checked via `supabase.auth.getSession()`).

Make sure your Supabase Auth settings allow redirects back to your site, especially `http://localhost:3000/update-password` for local development and your production domain for deployment.

Note: in this repo’s current `@supabase/supabase-js`/`@supabase/auth-js` version, the typed `verifyOtp({ type: 'recovery' ... })` flow requires an `email`, so we rely on the recovery redirect session initialization instead.

### 6. Running the Next.js App

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 File Structure Highlights

- `/scraper.py` - Core scraping and paragraph translation logic.
- `patch_missing_transcripts.py` - Efficiently patch an existing `episodes.json` (translating only missing paragraph(s)).
- `/episodes.json` - The generated dataset used by the web application.
- `/src/app/page.tsx` - The main server-rendered entrypoint.
- `/src/app/actions.ts` - Server actions for premium checks, admin premium management, and `translateWord` communication with OpenAI.
- `/src/app/update-password/page.tsx` - Password reset callback (verify OTP + update password).
- `/src/app/api/audio/route.ts` - Internal proxy to bypass Google Drive's audio streaming restrictions.
- `/src/components/MediaPlayer.tsx` - Sticky native HTML5 audio bar.
- `/src/components/AdminPremiumModal.tsx` - Admin-only UI to grant/revoke premium by email.
- `/src/app/globals.css` - The design system defining colors, typography, layout, and animations.
