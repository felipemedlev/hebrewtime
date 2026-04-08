import { NextResponse } from "next/server";
import { getEpisode, getAllEpisodesList } from "@/lib/episodes";

export async function generateStaticParams() {
  const episodes = getAllEpisodesList();
  return episodes.map((ep) => ({
    id: ep.episode.toString(),
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const episodeNum = parseInt(id, 10);

  if (isNaN(episodeNum)) {
    return NextResponse.json({ error: "Invalid episode number" }, { status: 400 });
  }

  const episode = getEpisode(episodeNum);

  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  return NextResponse.json(episode);
}
