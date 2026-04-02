# HebrewTime

HebrewTime is a beautiful, bilingual web-based reader for the Hebrew Time podcast. It provides an elegant Notion/Apple-like reading experience with side-by-side Hebrew and English paragraphs.

The application allows intermediate Hebrew learners to read podcast transcripts and click on any word to get a contextual, AI-powered translation (complete with Nekudot) and save it to their personal vocabulary list.

## 🚀 Key Features

- **Bilingual Interface**: Smooth side-by-side Hebrew and English paragraphs.
- **Contextual AI Translation**: Click any Hebrew word to translate it within the context of the sentence using OpenAI (GPT-4o-mini). Includes complete Nekudot vocalization.
- **Vocabulary Manager**: Save translated words to a personal vocabulary bank stored in your browser (`localStorage`), with reference to the original episode context.
- **Responsive Design**: Elegant slide-out sidebar for mobile devices.
- **Automated Scraping**: Python script to scrape episode transcripts from Squarespace and auto-translate missing English sections via OpenAI.

## 🏗 Architecture & Tech Stack

This project is built with **Next.js 16** (App Router) and **React 19**, focusing on performance and clean component design.

### Tech Stack
- **Framework**: Next.js 16
- **Styling**: Vanilla CSS (`globals.css`) for a clean, dependency-free aesthetic.
- **Icons**: `lucide-react`
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
- **Custom Hooks (`src/hooks/useVocabulary.ts`)**: Manages the extraction and persistence of vocabulary to `localStorage`.

## 🛠 Setup & Local Development

### 1. Environment Variables

Create a `.env` file in the root directory. You need an OpenAI API key for both the Python scraper (to translate paragraphs) and the Next.js app (for the clickable word translation dictionary).

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Updating Episodes (Python Scraper)

To fetch the latest podcast transcripts and auto-translate them to English:

```bash
# Ensure you have your .env setup with OPENAI_API_KEY
pip install requests beautifulsoup4 openai python-dotenv
python scraper.py
```
This generates/updates `episodes.json` and `episodes_checkpoint.json` which the Next.js app consumes.

### 3. Running the Next.js App

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
- `/src/app/globals.css` - The design system defining colors, typography, layout, and animations.
