import { NextRequest, NextResponse } from "next/server";
import { getPublishedEpisode, isKnownLevelSlug } from "@/lib/episodes";
import { isValidByteRange } from "@/lib/audioRange";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_AUDIO_BUCKET || "episode-audio";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ level: string; id: string }> }
) {
  const { level, id } = await params;
  const episodeNum = /^\d+$/.test(id) ? Number(id) : NaN;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  if (!Number.isSafeInteger(episodeNum) || episodeNum < 1) {
    return NextResponse.json({ error: "Invalid episode number" }, { status: 400 });
  }

  if (!(await isKnownLevelSlug(level))) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  // Never expose storage objects for unpublished or missing lessons.
  const episode = await getPublishedEpisode(level, episodeNum);
  if (!episode) {
    return NextResponse.json({ error: "Audio not found" }, { status: 404 });
  }

  const objectPath = `${level}/${String(episodeNum).padStart(2, "0")}.mp3`;
  const storageUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const requestedRange = request.headers.get("range");
  if (requestedRange && !isValidByteRange(requestedRange)) {
    return new NextResponse("Invalid range", { status: 416 });
  }
  const range = requestedRange || undefined;

  let upstream: Response;
  try {
    upstream = await fetch(storageUrl, {
      cache: "no-store",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        ...(range ? { Range: range } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error(`Episode audio upstream failed (${objectPath}):`, error);
    return new NextResponse("Audio service unavailable", { status: 502 });
  }

  if (!upstream.ok) {
    console.error(`Episode audio fetch failed (${objectPath}):`, upstream.status);
    return new NextResponse("Audio not found", {
      status: upstream.status === 404 || upstream.status === 416 ? upstream.status : 502,
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-store");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }
  const contentRange = upstream.headers.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new NextResponse(upstream.body, { headers, status: upstream.status === 206 ? 206 : 200 });
}
