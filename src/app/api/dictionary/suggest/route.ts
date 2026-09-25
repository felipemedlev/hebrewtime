import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchDictionaryPrefix } from "@/lib/dictionaryLookup";
import { checkRateLimitWithRetry, clampString, INPUT_LIMITS } from "@/lib/actionGuards";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const safeQuery = clampString(searchParams.get("q") ?? "", INPUT_LIMITS.word);

  if (!safeQuery) {
    return NextResponse.json({ suggestions: [], status: "empty" });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ suggestions: [], status: "unavailable" }, { status: 503 });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anon";

  const rateLimit = checkRateLimitWithRetry(`ip:${ip}`, "searchDictionarySuggestions");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { suggestions: [], status: "rate_limited", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  try {
    const suggestions = await searchDictionaryPrefix(supabaseAdmin, safeQuery, 8);
    return NextResponse.json({ suggestions, status: suggestions.length ? "success" : "empty" }, {
      headers: { "Cache-Control": "private, max-age=0, s-maxage=300, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ suggestions: [], status: "unavailable" }, { status: 503 });
  }
}
