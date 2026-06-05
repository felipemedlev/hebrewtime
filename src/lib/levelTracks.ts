import type { EpisodeListItem, Level, LevelTrackMeta } from "./types";

export const LAST_EPISODE_BY_LEVEL_KEY = "hebrewtime-last-episode-by-level";

export function readLastEpisodesByLevel(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LAST_EPISODE_BY_LEVEL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLastEpisodeForLevel(level: string, episode: number): void {
  if (typeof window === "undefined") return;
  const stored = readLastEpisodesByLevel();
  stored[level] = episode;
  window.localStorage.setItem(LAST_EPISODE_BY_LEVEL_KEY, JSON.stringify(stored));
}

export function finishedKey(level: string, episode: number): string {
  return `${level}:${episode}`;
}

export function countFinishedForLevel(
  level: string,
  episodeList: EpisodeListItem[],
  finishedEpisodes: Set<string>
): number {
  return episodeList
    .filter((ep) => ep.level === level)
    .filter((ep) => finishedEpisodes.has(finishedKey(level, ep.episode))).length;
}

export function resolveResumeEpisode(
  level: string,
  episodeList: EpisodeListItem[],
  lastEpisodesByLevel: Record<string, number>
): number | null {
  const levelEpisodes = episodeList
    .filter((ep) => ep.level === level)
    .sort((a, b) => a.episode - b.episode);

  if (levelEpisodes.length === 0) return null;

  const stored = lastEpisodesByLevel[level];
  if (stored != null && levelEpisodes.some((ep) => ep.episode === stored)) {
    return stored;
  }

  return levelEpisodes[0].episode;
}

export function buildLevelTrackMeta(
  levels: Level[],
  episodeList: EpisodeListItem[],
  finishedEpisodes: Set<string>,
  currentLevel: string,
  lastEpisodesByLevel: Record<string, number>
): LevelTrackMeta[] {
  return levels.map((level) => {
    const levelEpisodes = episodeList.filter((ep) => ep.level === level.slug);
    return {
      slug: level.slug,
      name: level.name,
      cefr: level.cefr ?? null,
      episodeCount: levelEpisodes.length,
      finishedCount: countFinishedForLevel(level.slug, episodeList, finishedEpisodes),
      resumeEpisode: resolveResumeEpisode(level.slug, episodeList, lastEpisodesByLevel),
      isActive: level.slug === currentLevel,
    };
  });
}
