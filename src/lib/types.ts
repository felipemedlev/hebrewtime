import type { LangCode } from "./i18n/types";

export type { LangCode };

export type EpisodeTranslations = Partial<Record<LangCode, string[]>>;

export type SentenceTiming = {
  text: string;
  start: number;
  end: number;
};

export type ParagraphTiming = {
  text: string;
  start: number;
  end: number;
  sentences?: SentenceTiming[];
};

export type Level = {
  slug: string;
  name: string;
  cefr?: string | null;
  sortOrder: number;
};

export type LevelTrackMeta = {
  slug: string;
  name: string;
  cefr: string | null;
  episodeCount: number;
  finishedCount: number;
  resumeEpisode: number | null;
  isActive: boolean;
};

export type Episode = {
  id: string;
  level: string;
  episode: number;
  url: string;
  audio_url?: string;
  title: string;
  hebrew_paragraphs: (string | ParagraphTiming)[];
  hebrew_text: string;
  english_paragraphs: string[];
  translations: EpisodeTranslations;
};

export type EpisodeListItem = {
  level: string;
  episode: number;
  title: string;
};

export type FinishedEpisodeKey = {
  level: string;
  episode: number;
};

export type ExamplePhrase = {
  hebrew: string;
  english: string;
};

export type VocabWord = {
  id: string;
  word: string;
  wordWithNekudot?: string;
  verbFormWithNekudot?: string;
  translation: string;
  pronunciation?: string;
  episodeTitle: string;
  episodeUrl: string;
  savedAt: number;
  examplePhrases?: ExamplePhrase[];
};

export type FlashcardRating = 0 | 1 | 3 | 5; // Again (0), Hard (1), Good (3), Easy (5)

export type FlashcardProgress = {
  id: string;
  user_id: string;
  vocab_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at: string;
  is_learned: boolean;
  last_reviewed_at: string | null;
  created_at: string;
  /** FSRS memory stability (days); null for legacy SM-2 rows until next review */
  stability: number | null;
  /** FSRS difficulty (1–10); null for legacy rows */
  difficulty: number | null;
  /** FSRS State: 0=New, 1=Learning, 2=Review, 3=Relearning */
  state: number;
  lapses: number;
};

export type FlashcardStats = {
  total: number;
  learned: number;
  active: number;
  due: number;
  newCount: number;
  learning: number;
  reviewedToday: number;
  nextReviewAt: string | null;
  avgRecall: number;
  progressPercent: number;
};

export type FlashcardItem = {
  vocabWord: VocabWord;
  progress: FlashcardProgress | null;
};

export type AdminUserStat = {
  userId: string;
  email: string;
  createdAt: string | null;
  isPremium: boolean;
  activeSeconds: number;
  lastSeenAt: string | null;
  episodesCompleted: number;
  wordsSaved: number;
  flashcardReviews: number;
};

export type AdminDashboardSummary = {
  totalUsers: number;
  premiumUsers: number;
  totalActiveSeconds: number;
  totalEpisodesCompleted: number;
  totalWordsSaved: number;
};

export type AdminUserStatsResponse = {
  ok: boolean;
  message?: string;
  summary?: AdminDashboardSummary;
  users?: AdminUserStat[];
};

