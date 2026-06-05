const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

export function resolveEpisodeAudioSrc(
  audioUrl: string | null | undefined,
  level: string | null | undefined,
  episodeNum: number | null | undefined
): string | null {
  if (!audioUrl) return null;

  if (audioUrl.includes("drive.google.com")) {
    return `/api/audio?url=${encodeURIComponent(audioUrl)}`;
  }

  if (
    level &&
    episodeNum != null &&
    SUPABASE_HOST &&
    audioUrl.includes(SUPABASE_HOST) &&
    audioUrl.includes("/storage/")
  ) {
    return `/api/episode-audio/${encodeURIComponent(level)}/${episodeNum}`;
  }

  return audioUrl;
}
