import {
  getAllEpisodesList,
  getDefaultLevel,
  getEpisode,
  getFirstEpisodeNum,
  getLevels,
} from "@/lib/episodes";
import AppShell from "@/components/AppShell";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getServerLang } from "@/lib/i18n/languagePreference.server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialLang = await getServerLang();
  const levels = await getLevels();
  const defaultLevel = await getDefaultLevel();
  const firstNum = await getFirstEpisodeNum(defaultLevel);
  const initialEpisode = firstNum ? await getEpisode(defaultLevel, firstNum) : null;
  const episodeList = await getAllEpisodesList();

  return (
    <LanguageProvider initialLang={initialLang}>
      <AppShell
        levels={levels}
        defaultLevel={defaultLevel}
        episodeList={episodeList}
        initialEpisode={initialEpisode}
      />
    </LanguageProvider>
  );
}
