import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { searchDictionaryPrefix } from "@/lib/dictionaryLookup";
import { checkRateLimit, clampString, INPUT_LIMITS } from "@/lib/actionGuards";

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
    return NextResponse.json({ suggestions: [] });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anon";

  if (!checkRateLimit(`ip:${ip}`, "searchDictionarySuggestions")) {
    return NextResponse.json({ suggestions: [], type: "error" }, { status: 429 });
  }

  const suggestions = await searchDictionaryPrefix(supabaseAdmin, safeQuery, 8);
  return NextResponse.json({ suggestions });
}
