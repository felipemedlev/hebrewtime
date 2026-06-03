export type ParagraphTiming = {
  text: string;
  start: number;
  end: number;
};

export type Episode = {
  episode: number;
  url: string;
  audio_url?: string;
  title: string;
  hebrew_paragraphs: (string | ParagraphTiming)[];
  hebrew_text: string;
  english_paragraphs: string[];
};

export type EpisodeListItem = {
  episode: number;
  title: string;
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
};

export type FlashcardItem = {
  vocabWord: VocabWord;
  progress: FlashcardProgress | null;
};

