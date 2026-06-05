import {
  getAllEpisodesList,
  getDefaultLevel,
  getEpisode,
  getFirstEpisodeNum,
  getLevels,
} from "@/lib/episodes";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const levels = await getLevels();
  const defaultLevel = await getDefaultLevel();
  const firstNum = await getFirstEpisodeNum(defaultLevel);
  const initialEpisode = firstNum ? await getEpisode(defaultLevel, firstNum) : null;
  const episodeList = await getAllEpisodesList();

  return (
    <AppShell
      levels={levels}
      defaultLevel={defaultLevel}
      episodeList={episodeList}
      initialEpisode={initialEpisode}
    />
  );
}
