export type Episode = {
  episode: number;
  url: string;
  audio_url?: string;
  title: string;
  hebrew_paragraphs: string[];
  hebrew_text: string;
  english_paragraphs: string[];
};

export type EpisodeListItem = {
  episode: number;
  title: string;
};

export type VocabWord = {
  id: string;
  word: string;
  wordWithNekudot?: string;
  translation: string;
  episodeTitle: string;
  episodeUrl: string;
  savedAt: number;
};
