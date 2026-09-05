import { NextResponse } from "next/server";
import { getAllPublishedEpisodeParams, getEpisode, isKnownLevelSlug } from "@/lib/episodes";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const params = await getAllPublishedEpisodeParams();
  return params.map(({ level, id }) => ({ level, id }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ level: string; id: string }> }
) {
  const { level, id } = await params;
  const episodeNum = /^\d+$/.test(id) ? Number(id) : NaN;

  if (!Number.isSafeInteger(episodeNum) || episodeNum < 1) {
    return NextResponse.json({ error: "Invalid episode number" }, { status: 400 });
  }

  if (!(await isKnownLevelSlug(level))) {
    return NextResponse.json({ error: "Invalid level" }, { status: 400 });
  }

  const episode = await getEpisode(level, episodeNum);

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  return NextResponse.json(episode, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
