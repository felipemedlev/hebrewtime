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
  const [initialLang, levels] = await Promise.all([getServerLang(), getLevels()]);
  const defaultLevel = await getDefaultLevel();
  const [firstNum, episodeList] = await Promise.all([
    getFirstEpisodeNum(defaultLevel),
    getAllEpisodesList(),
  ]);
  const initialEpisode = firstNum ? await getEpisode(defaultLevel, firstNum) : null;

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
