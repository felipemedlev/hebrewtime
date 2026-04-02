import { getAllEpisodesList, getEpisode, getFirstEpisodeNum } from "@/lib/episodes";
import AppShell from "@/components/AppShell";

export default function Home() {
  const episodeList = getAllEpisodesList();
  const firstNum = getFirstEpisodeNum();
  const initialEpisode = firstNum ? getEpisode(firstNum) : null;

  return (
    <AppShell
      episodeList={episodeList}
      initialEpisode={initialEpisode}
    />
  );
}
