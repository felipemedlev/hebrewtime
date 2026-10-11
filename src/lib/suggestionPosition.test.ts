import { describe, expect, it } from "vitest";
import { getSuggestionPosition } from "./suggestionPosition";

describe("suggestion popup placement", () => {
  it("uses space below the input and caps the list at 420px", () => {
    expect(getSuggestionPosition({ top: 100, bottom: 140, left: 500, width: 350 },
      { top: 0, left: 0, width: 1280, height: 900 })).toEqual({
      left: 500, top: 146, width: 350, maxHeight: 420, transform: undefined,
    });
  });

  it("flips above the input near the desktop viewport bottom", () => {
    const position = getSuggestionPosition({ top: 500, bottom: 540, left: 20, width: 350 },
      { top: 0, left: 0, width: 1280, height: 600 });
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
    expect(position).toMatchObject({ top: 286, left: 96, width: 268, maxHeight: 68, transform: undefined });
  });

  it("never calculates a negative list height", () => {
    const position = getSuggestionPosition({ top: 5, bottom: 50, left: 0, width: 200 },
      { top: 0, left: 0, width: 200, height: 60 });
    expect(position.maxHeight).toBe(0);
  });

  it("hides the popup when the keyboard obscures the input", () => {
    const position = getSuggestionPosition({ top: 500, bottom: 540, left: 20, width: 350 },
      { top: 100, left: 0, width: 390, height: 300 });
    expect(position).toMatchObject({ top: 546, maxHeight: 0, transform: undefined });
  });

  it.each([320, 390, 768])("keeps results below the input at mobile width %i", (width) => {
    const position = getSuggestionPosition({ top: 180, bottom: 224, left: 16, width: width - 32 },
      { top: 0, left: 0, width, height: 300 });
    expect(position).toMatchObject({ top: 230, maxHeight: 54, transform: undefined });
  });

  it("keeps results below in landscape with little vertical space", () => {
    const position = getSuggestionPosition({ top: 180, bottom: 224, left: 200, width: 440 },
      { top: 0, left: 0, width: 844, height: 300 });
    expect(position).toMatchObject({ top: 230, maxHeight: 54, transform: undefined });
  });

  it("supports keeping the list below on wider touch devices", () => {
    const position = getSuggestionPosition({ top: 400, bottom: 444, left: 200, width: 440 },
      { top: 0, left: 0, width: 1024, height: 600 }, true);
    expect(position).toMatchObject({ top: 450, maxHeight: 134, transform: undefined });
  });

  it("does not float a detached list over an input scrolled out of view", () => {
    const position = getSuggestionPosition({ top: -50, bottom: -6, left: 16, width: 358 },
      { top: 0, left: 0, width: 390, height: 844 });
    expect(position.maxHeight).toBe(0);
  });
});
