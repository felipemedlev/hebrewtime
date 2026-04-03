# HebrewTime

HebrewTime is a beautiful, bilingual web-based reader for the Hebrew Time podcast. It provides an elegant Notion/Apple-like reading experience with side-by-side Hebrew and English paragraphs.

The application allows intermediate Hebrew learners to read podcast transcripts and click on any word to get a contextual, AI-powered translation (complete with Nekudot) and save it to their personal vocabulary list.

## 🚀 Key Features

- **Bilingual Interface**: Smooth side-by-side Hebrew and English paragraphs.
- **Contextual AI Translation**: Click any Hebrew word to translate it within the context of the sentence using OpenAI (GPT-4o-mini). Includes complete Nekudot vocalization.
- **Vocabulary Manager & Auth**: Users can create an account via Supabase Email Auth, including “Forgot password” recovery. Translated words are securely synced to a Supabase PostgreSQL database, ensuring vocabulary is preserved across devices with reference to the original episode context.
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
- **Data Fetching/AI**: OpenAI API for on-the-fly contextual word translations.
- **Scraper**: Python 3 (`requests`, `beautifulsoup4`, `openai`).

### Core Architecture
Following a recent refactor, the app utilizes Next.js Server Components and dynamic API routes for optimal performance:

- **Server-Side Data Layer (`src/lib/episodes.ts`)**: Loads the 1.4MB `episodes.json` dataset directly from the filesystem on the server, ensuring the client bundle remains tiny.
- **Dynamic API Routes (`/api/episode/[id]/route.ts`)**: Client fetches full episode data on demand when navigating between episodes.
- **Component Breakdown (`src/components/`)**:
  - `AppShell.tsx`: The main responsive client wrapper managing state and layout.
  - `Sidebar.tsx`: Navigation, search, and tab switching.
  - `EpisodeViewer.tsx`: Bilingual reading experience and word-click handling.
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
```

### 2. Supabase Database Setup

For vocabulary saving to work, navigate to your Supabase SQL Editor and execute the following snippet to create the table and its Row Level Security policies:

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
```

### 3. Updating Episodes (Python Scraper)

To fetch the latest podcast transcripts and auto-translate them to English:

```bash
# Ensure you have your .env setup with OPENAI_API_KEY
pip install requests beautifulsoup4 openai python-dotenv
python scraper.py
```
This generates/updates `episodes.json` and `episodes_checkpoint.json` which the Next.js app consumes.

### 4. Password Recovery (Forgot Password)
Password reset is implemented using Supabase Email Auth:

- The “Forgot password?” button in `AuthModal` calls `supabase.auth.resetPasswordForEmail(...)`.
- The reset email redirects the user to `/update-password`.
- `/src/app/update-password/page.tsx` sets the new password via `supabase.auth.updateUser(...)` after Supabase initializes a recovery session from the URL (checked via `supabase.auth.getSession()`).

Make sure your Supabase Auth settings allow redirects back to your site, especially `http://localhost:3000/update-password` for local development and your production domain for deployment.

Note: in this repo’s current `@supabase/supabase-js`/`@supabase/auth-js` version, the typed `verifyOtp({ type: 'recovery' ... })` flow requires an `email`, so we rely on the recovery redirect session initialization instead.

### 5. Running the Next.js App

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📁 File Structure Highlights

- `/scraper.py` - Core scraping and paragraph translation logic.
- `/episodes.json` - The generated dataset used by the web application.
- `/src/app/page.tsx` - The main server-rendered entrypoint.
- `/src/app/actions.ts` - Server action `translateWord` communicating securely with OpenAI.
- `/src/app/update-password/page.tsx` - Password reset callback (verify OTP + update password).
- `/src/app/api/audio/route.ts` - Internal proxy to bypass Google Drive's audio streaming restrictions.
- `/src/components/MediaPlayer.tsx` - Sticky native HTML5 audio bar.
- `/src/app/globals.css` - The design system defining colors, typography, layout, and animations.
