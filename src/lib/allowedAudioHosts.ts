const ALLOWED_AUDIO_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
]);

export function isAllowedAudioProxyUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;

    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_AUDIO_HOSTS.has(hostname)) return false;

    // Reject private/reserved IP hostnames (defense in depth)
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function buildProxiedAudioUrl(rawUrl: string): string | null {
  if (!isAllowedAudioProxyUrl(rawUrl)) return null;

  const fetchUrl =
    rawUrl.includes("drive.google.com") && !rawUrl.includes("confirm=t")
      ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}confirm=t`
      : rawUrl;

  return fetchUrl;
}
