import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { getServerLang } from "@/lib/i18n/languagePreference.server";

export default async function UpdatePasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLang = await getServerLang();
  return <LanguageProvider initialLang={initialLang}>{children}</LanguageProvider>;
}
