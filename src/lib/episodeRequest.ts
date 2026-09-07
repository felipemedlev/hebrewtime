export type EpisodeRequestContext = {
  requestId: number;
  userId: string | null;
};

/** A response may update the reader only while both request and account match. */
export function isEpisodeRequestCurrent(
  request: EpisodeRequestContext,
  active: EpisodeRequestContext
): boolean {
  return request.requestId === active.requestId && request.userId === active.userId;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/** Timeouts are user-visible failures; superseded request aborts are ignored. */
export function shouldReportEpisodeLoadError(error: unknown, didTimeout: boolean): boolean {
  return didTimeout || !isAbortError(error);
}
