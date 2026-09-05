import { describe, expect, it } from "vitest";
import { checkRateLimit, clampString, isValidEmail } from "./actionGuards";

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
});
