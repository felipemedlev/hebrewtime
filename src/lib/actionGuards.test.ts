import { describe, expect, it } from "vitest";
import { checkRateLimit, checkRateLimitWithRetry, clampString, isValidEmail } from "./actionGuards";

describe("server action input guards", () => {
  it("rejects non-string values without throwing", () => {
    expect(clampString({ injected: true }, 20)).toBe("");
    expect(clampString("  שלום  ", 4)).toBe("שלום");
    expect(isValidEmail(null)).toBe(false);
  });

  it("fails closed for malformed rate-limit actions", () => {
    expect(checkRateLimit("user-1", null)).toBe(false);
    expect(checkRateLimit("user-1", "unknown-action")).toBe(false);
  });

  it("reports a retry delay after a search limit is reached", () => {
    const key = `dictionary-search-test-${Date.now()}`;
    for (let i = 0; i < 60; i += 1) {
      expect(checkRateLimit(key, "searchDictionarySuggestions")).toBe(true);
    }
    const limited = checkRateLimitWithRetry(key, "searchDictionarySuggestions");
    expect(limited.allowed).toBe(false);
    expect(limited.retryAfterSeconds).toBeGreaterThan(0);
  });
});
