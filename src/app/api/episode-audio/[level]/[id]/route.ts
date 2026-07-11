import { NextResponse } from "next/server";
import { isKnownLevelSlug } from "@/lib/episodes";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_AUDIO_BUCKET || "episode-audio";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ level: string; id: string }> }
) {
  const { level, id } = await params;
  const episodeNum = parseInt(id, 10);

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  if (isNaN(episodeNum) || episodeNum < 1) {
    return NextResponse.json({ error: "Invalid episode number" }, { status: 400 });
  }

  if (!(await isKnownLevelSlug(level))) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  const objectPath = `${level}/${String(episodeNum).padStart(2, "0")}.mp3`;
  const storageUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;

  const upstream = await fetch(storageUrl, {
    cache: "no-store",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error(`Episode audio fetch failed (${objectPath}):`, upstream.status, detail);
    return new NextResponse("Audio not found", { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "no-store");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new NextResponse(upstream.body, { headers });
}
