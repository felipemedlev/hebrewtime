import { cookies } from "next/headers";
import { LANG_COOKIE_NAME, parseLangCookie } from "./languagePreference";
import type { LangCode } from "./types";

export async function getServerLang(): Promise<LangCode> {
  const cookieStore = await cookies();
  return parseLangCookie(cookieStore.get(LANG_COOKIE_NAME)?.value);
}
