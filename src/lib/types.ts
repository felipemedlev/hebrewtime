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

export type AuxForm = {
  note: string | null;
  hebrew_with_nekudot: string;
  hebrew_plain: string;
  transliteration: string | null;
  audio_url: string | null;
};

export type DictionaryForm = {
  form_id: string;
  hebrew_with_nekudot: string;
  hebrew_plain: string;
  transliteration: string | null;
  meaning: string | null;
  audio_url: string | null;
  row_label: string | null;
  column_label: string | null;
  section_title: string | null;
  section_subtitle: string | null;
  person: 1 | 2 | 3 | null;
  gender: "masculine" | "feminine" | null;
  number: "singular" | "plural" | null;
  tense: "present" | "past" | "future" | "imperative" | "infinitive" | null;
  state: "absolute" | "construct" | null;
  voice: "active" | "passive" | null;
  form_type: "verb" | "infinitive" | "noun" | "adjective" | "pronominal" | "numeral" | null;
  aux_forms: AuxForm[];
};

export type ConjugationSection = {
  title: string;
  subtitle: string | null;
  form_ids: string[];
};

export type DictionaryEntry = {
  pealim_id: number;
  slug?: string;
  url?: string;
  word: string;
  word_with_nekudot: string;
  transliteration: string | null;
  audio_url: string | null;
  root: string | null;
  part_of_speech: string;
  pos_detail: string | null;
  meaning: string;
  meanings: string[];
  notes: string[];
  conjugation_sections: ConjugationSection[];
  forms: DictionaryForm[];
  see_also_ids?: number[];
  scraped_at?: string;
};

export type DictionaryEntryDetails = Pick<
  DictionaryEntry,
  | "pealim_id"
  | "word"
  | "word_with_nekudot"
  | "transliteration"
  | "audio_url"
  | "root"
  | "part_of_speech"
  | "pos_detail"
  | "meaning"
  | "meanings"
  | "notes"
  | "conjugation_sections"
  | "forms"
>;

export type VocabEntryKind = "word" | "phrase";

export type VocabWord = {
  id: string;
  word: string;
  wordWithNekudot?: string;
  verbFormWithNekudot?: string;
  translation: string;
  pronunciation?: string;
  dictionaryPealimId?: number | null;
  partOfSpeech?: string | null;
  entryKind?: VocabEntryKind;
  episodeTitle: string;
  episodeUrl: string;
  savedAt: number;
  examplePhrases?: ExamplePhrase[];
};

export type FlashcardRating = 0 | 1 | 3 | 5; // Again (0), Hard (1), Good (3), Easy (5)

export type FlashcardDirection = "forward" | "reverse";

export type FlashcardProgress = {
  id: string;
  user_id: string;
  vocab_id: string;
  direction: FlashcardDirection;
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

export type ReviewModality = "fill_in" | "matching";

export type FillInVocabInput = {
  index: number;
  word: string;
  translation: string;
  wordWithNekudot?: string;
  entryKind?: VocabEntryKind;
};

export type FillInExercisePayload = {
  index: number;
  maskedHebrew: string;
  fullHebrew: string;
  sentenceMeaning: string;
  answer: string;
  answerWithNekudot: string;
};

export type FillInExercise = FillInExercisePayload & {
  vocabId: string;
};

export type ReviewPracticeAttempt = {
  id: string;
  user_id: string;
  vocab_id: string;
  modality: ReviewModality;
  correct: boolean;
  created_at: string;
};

export type ReviewPracticeStats = {
  fillInAttemptsToday: number;
  fillInCorrectToday: number;
  fillInAttempts7d: number;
  fillInCorrect7d: number;
  fillInAttemptsAll: number;
  fillInCorrectAll: number;
  fillInAccuracy7d: number;
  fillInAccuracyToday: number;
  matchingAttemptsToday: number;
  matchingCorrectToday: number;
  matchingAttempts7d: number;
  matchingCorrect7d: number;
  matchingAttemptsAll: number;
  matchingCorrectAll: number;
  matchingAccuracy7d: number;
  matchingAccuracyToday: number;
  practicedVocabIdsByModality: Record<ReviewModality, Set<string>>;
  weakWords: { vocabId: string; attempts: number; correct: number }[];
  matchingWeakWords: { vocabId: string; attempts: number; correct: number }[];
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

