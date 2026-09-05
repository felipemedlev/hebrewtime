import { describe, expect, it } from "vitest";
import { isValidByteRange } from "./audioRange";

describe("isValidByteRange", () => {
  it("accepts open ended and suffix single ranges", () => {
    expect(isValidByteRange("bytes=0-1")).toBe(true);
    expect(isValidByteRange("bytes=500-")).toBe(true);
    expect(isValidByteRange("bytes=-500")).toBe(true);
  });

  it("rejects empty, multi-range, and malformed values", () => {
    expect(isValidByteRange("bytes=-")).toBe(false);
    expect(isValidByteRange("bytes=0-1,2-3")).toBe(false);
    expect(isValidByteRange("items=0-1")).toBe(false);
    expect(isValidByteRange("bytes=4-2")).toBe(false);
    expect(isValidByteRange("bytes=-0")).toBe(false);
  });
});
