import { describe, expect, it } from "vitest";
import { getSuggestionPosition } from "./suggestionPosition";

describe("suggestion popup placement", () => {
  it("uses space below the input and caps the list at 420px", () => {
    expect(getSuggestionPosition({ top: 100, bottom: 140, left: 500, width: 350 },
      { top: 0, left: 0, width: 1280, height: 900 })).toEqual({
      left: 500, top: 146, width: 350, maxHeight: 420, transform: undefined,
    });
  });

  it("flips above the input near the viewport bottom", () => {
    const position = getSuggestionPosition({ top: 500, bottom: 540, left: 20, width: 350 },
      { top: 0, left: 0, width: 390, height: 600 });
    expect(position).toMatchObject({ top: 494, maxHeight: 420, transform: "translateY(-100%)" });
  });

  it("stays below when there is room for several rows", () => {
    const position = getSuggestionPosition({ top: 400, bottom: 440, left: 20, width: 350 },
      { top: 0, left: 0, width: 390, height: 844 });
    expect(position).toMatchObject({ top: 446, maxHeight: 382, transform: undefined });
  });

  it("uses the visual viewport after zoom or keyboard changes", () => {
    const position = getSuggestionPosition({ top: 240, bottom: 280, left: 10, width: 400 },
      { top: 120, left: 80, width: 300, height: 250 });
    expect(position).toMatchObject({ top: 234, left: 96, width: 268, maxHeight: 98 });
  });

  it("never calculates a negative list height", () => {
    const position = getSuggestionPosition({ top: 5, bottom: 50, left: 0, width: 200 },
      { top: 0, left: 0, width: 200, height: 60 });
    expect(position.maxHeight).toBe(0);
  });

  it("keeps the popup inside the visible area when the keyboard obscures the anchor", () => {
    const position = getSuggestionPosition({ top: 500, bottom: 540, left: 20, width: 350 },
      { top: 100, left: 0, width: 390, height: 300 });
    expect(position).toMatchObject({ top: 384, maxHeight: 268, transform: "translateY(-100%)" });
  });
});
