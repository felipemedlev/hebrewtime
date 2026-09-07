import { describe, expect, it } from "vitest";
import {
  isEpisodeRequestCurrent,
  isAbortError,
  shouldReportEpisodeLoadError,
} from "./episodeRequest";

describe("episode request ownership", () => {
  it("invalidates a guest request when authentication arrives during loading", () => {
    expect(
      isEpisodeRequestCurrent(
        { requestId: 4, userId: null },
        { requestId: 5, userId: "account-a" }
      )
    ).toBe(false);
  });

  it("invalidates an account request when the account changes without a replacement", () => {
    expect(
      isEpisodeRequestCurrent(
        { requestId: 7, userId: "account-a" },
        { requestId: 8, userId: "account-b" }
      )
    ).toBe(false);
  });

  it("rejects a superseded response after its JSON body finishes parsing", () => {
    expect(
      isEpisodeRequestCurrent(
        { requestId: 10, userId: "account-a" },
        { requestId: 11, userId: "account-a" }
      )
    ).toBe(false);
  });

  it("reports a timeout while ignoring an intentional supersession abort", () => {
    const abort = { name: "AbortError" };
    expect(isAbortError(abort)).toBe(true);
    expect(shouldReportEpisodeLoadError(abort, false)).toBe(false);
    expect(shouldReportEpisodeLoadError(abort, true)).toBe(true);
  });

  it("allows a new retry request to commit after a previous request failed", () => {
    expect(
      isEpisodeRequestCurrent(
        { requestId: 13, userId: "account-a" },
        { requestId: 13, userId: "account-a" }
      )
    ).toBe(true);
  });
});
