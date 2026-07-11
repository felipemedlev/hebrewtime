const ALLOWED_AUDIO_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
]);

/** Google CDN hosts that Drive may redirect to when serving file bytes. */
const ALLOWED_AUDIO_REDIRECT_HOST_SUFFIXES = [
  ".googleusercontent.com",
  ".google.com",
] as const;

const ALLOWED_AUDIO_REDIRECT_HOSTS = new Set([
  "drive.usercontent.google.com",
]);

const ALLOWED_AUDIO_CONTENT_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/x-m4a",
  "application/octet-stream",
]);

function isPrivateOrReservedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "::1"
  ) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  return false;
}

function isAllowedHost(hostname: string, allowRedirectTargets: boolean): boolean {
  const host = hostname.toLowerCase();
  if (isPrivateOrReservedHost(host)) return false;

  if (ALLOWED_AUDIO_HOSTS.has(host)) return true;

  if (!allowRedirectTargets) return false;

  if (ALLOWED_AUDIO_REDIRECT_HOSTS.has(host)) return true;

  return ALLOWED_AUDIO_REDIRECT_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function isAllowedAudioProxyUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    return isAllowedHost(parsed.hostname, false);
  } catch {
    return false;
  }
}

export function isAllowedAudioRedirectUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    return isAllowedHost(parsed.hostname, true);
  } catch {
    return false;
  }
}

export function isAllowedAudioContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!normalized) return false;
  if (normalized.startsWith("audio/")) return true;
  return ALLOWED_AUDIO_CONTENT_TYPES.has(normalized);
}

export function buildProxiedAudioUrl(rawUrl: string): string | null {
  if (!isAllowedAudioProxyUrl(rawUrl)) return null;

  const fetchUrl =
    rawUrl.includes("drive.google.com") && !rawUrl.includes("confirm=t")
      ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}confirm=t`
      : rawUrl;

  return fetchUrl;
}
