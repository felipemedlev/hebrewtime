import { describe, expect, it } from "vitest";
import { isLangCode, LANG_CODES, LANGUAGE_NAMES_FOR_AI } from "./types";

describe("supported languages", () => {
  it("keeps the supported catalogs and retires Portuguese/Ukrainian", () => {
    expect(LANG_CODES).toEqual(["en", "ru", "es", "fr"]);
    expect(isLangCode("pt")).toBe(false);
    expect(isLangCode("uk")).toBe(false);
    expect(LANGUAGE_NAMES_FOR_AI).not.toHaveProperty("pt");
    expect(LANGUAGE_NAMES_FOR_AI).not.toHaveProperty("uk");
  });
});
