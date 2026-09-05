/**
 * Audio browsers send a single RFC 7233 byte range. We intentionally reject
 * multi-range and empty ranges so the proxy never forwards an ambiguous value.
 */
export function isValidByteRange(value: string): boolean {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return false;

  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (start !== null && (!Number.isSafeInteger(start) || start < 0)) return false;
  if (end !== null && (!Number.isSafeInteger(end) || end < 0)) return false;
  if (start === null) return end !== null && end > 0;
  return end === null || start <= end;
}
