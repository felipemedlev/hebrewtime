import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ search: vi.fn(), rateLimit: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/dictionaryLookup", () => ({ searchDictionaryPrefix: mocks.search }));
vi.mock("@/lib/actionGuards", async (original) => ({
  ...await original<typeof import("@/lib/actionGuards")>(),
  checkRateLimitWithRetry: mocks.rateLimit,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-fixture");
  mocks.rateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.search.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

const request = (query: string) => new Request(`http://localhost/api/dictionary/suggest?${query}`);

describe("dictionary suggestion endpoint", () => {
  it("keeps complete search as the default for existing callers", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("q=test"));
    expect(mocks.search).toHaveBeenCalledWith({}, "test", 8, "complete");
    expect(await response.json()).toEqual({ suggestions: [], status: "empty" });
  });

  it("returns completion eligibility with direct results", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("q=test&mode=direct"));
    expect(mocks.search).toHaveBeenCalledWith({}, "test", 8, "direct");
    expect(await response.json()).toEqual({ suggestions: [], status: "empty", needsCompletion: true });
  });

  it("does not request completion for a full list or a short query", async () => {
    const { GET } = await import("./route");
    mocks.search.mockResolvedValueOnce(Array.from({ length: 8 }, (_, pealimId) => ({ pealimId })));
    expect((await (await GET(request("q=test&mode=direct"))).json()).needsCompletion).toBe(false);
    expect((await (await GET(request("q=tx&mode=direct"))).json()).needsCompletion).toBe(false);
  });

  it("preserves rate limits for both modes", async () => {
    const { GET } = await import("./route");
    mocks.rateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 12 });
    for (const mode of ["direct", "complete"]) {
      const response = await GET(request(`q=test&mode=${mode}`));
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("12");
    }
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it("keeps empty queries local and surfaces database failures", async () => {
    const { GET } = await import("./route");
    expect(await (await GET(request("q="))).json()).toEqual({ suggestions: [], status: "empty" });
    expect(mocks.search).not.toHaveBeenCalled();
    mocks.search.mockRejectedValueOnce(new Error("fixture failure"));
    const response = await GET(request("q=test&mode=direct"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ suggestions: [], status: "unavailable" });
  });
});
