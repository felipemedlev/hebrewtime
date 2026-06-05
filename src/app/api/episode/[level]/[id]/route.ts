import { NextResponse } from "next/server";
import { getAllPublishedEpisodeParams, getEpisode } from "@/lib/episodes";

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
  const episodeNum = parseInt(id, 10);

  if (isNaN(episodeNum)) {
    return NextResponse.json({ error: "Invalid episode number" }, { status: 400 });
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
