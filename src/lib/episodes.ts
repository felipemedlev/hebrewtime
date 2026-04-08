import fs from "fs";
import path from "path";
import type { Episode, EpisodeListItem } from "./types";

function loadEpisodes(): Episode[] {
  const filePath = path.join(process.cwd(), "episodes.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = JSON.parse(raw) as any[];

  const episodesMap = new Map<number, Episode>();

  data.forEach((ep) => {
    const epNum = Number(ep.episode);
    if (isNaN(epNum)) return;

    let normalizedTitle = ep.title;
    const bracketMatch = normalizedTitle.match(/^\[(\d+)\]\s*(.*)/);
    if (bracketMatch) {
      normalizedTitle = `Episode ${bracketMatch[1]}: ${bracketMatch[2]}`;
    }

    episodesMap.set(epNum, {
      ...ep,
      episode: epNum,
      title: normalizedTitle,
    });
  });

  return Array.from(episodesMap.values()).sort((a, b) => a.episode - b.episode);
}

let cachedEpisodes: Episode[] | null = null;

function getAll(): Episode[] {
  if (!cachedEpisodes) {
    cachedEpisodes = loadEpisodes();
  }
  return cachedEpisodes;
}

export function getAllEpisodesList(): EpisodeListItem[] {
  return getAll().map((ep) => ({
    episode: ep.episode,
    title: ep.title,
  }));
}

export function getEpisode(num: number): Episode | null {
  return getAll().find((ep) => ep.episode === num) || null;
}

export function getFirstEpisodeNum(): number | null {
  const all = getAll();
  return all.length > 0 ? all[0].episode : null;
}
