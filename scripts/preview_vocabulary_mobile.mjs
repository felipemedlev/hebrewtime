import { createServer } from "node:http";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Synthetic preview only. No database credentials, AI calls, or vocabulary writes.
// Pass an externally installed esbuild module path as the first argument.
const runtime = process.argv[2] ? pathToFileURL(resolve(process.argv[2])).href : "esbuild";
const { build } = await import(runtime);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = await mkdtemp(join(tmpdir(), "vocabulary-mobile-"));
const port = Number(process.argv[3] ?? 3012);
const source = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import AddVocabWordModal from "${root}/src/components/AddVocabWordModal.tsx";
import { LanguageProvider } from "${root}/src/lib/i18n/LanguageProvider.tsx";
import "${root}/src/app/globals.css";

// Model a keyboard that changes visualViewport without resizing the layout viewport.
const viewport = Object.assign(new EventTarget(), {
  offsetTop: 0, offsetLeft: 0, width: innerWidth, height: innerHeight,
});
Object.defineProperty(window, "visualViewport", { value: viewport, configurable: true });
let keyboardOpen = false;
window.addEventListener("resize", () => {
  viewport.width = innerWidth;
  if (!keyboardOpen) viewport.height = innerHeight;
  viewport.dispatchEvent(new Event("resize"));
});
document.addEventListener("keydown", (event) => {
  if (!event.altKey) return;
  if (event.key.toLowerCase() === "k") {
    event.preventDefault();
    keyboardOpen = !keyboardOpen;
    viewport.offsetTop = keyboardOpen ? 80 : 0;
    viewport.height = keyboardOpen ? 320 : innerHeight;
    viewport.dispatchEvent(new Event("resize"));
  }
  if (event.key.toLowerCase() === "b") {
    event.preventDefault();
    const popup = document.querySelector(".add-vocab-suggestions");
    popup?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
    document.querySelector("#add-vocab-word-search")?.blur();
  }
});

function App() {
  const [open, setOpen] = useState(false);
  const lang = new URLSearchParams(location.search).get("lang") || "en";
  return <LanguageProvider initialLang={lang}>
    <div className="app-container"><div className="main-content">
      <button onClick={() => setOpen(true)}>Open vocabulary modal</button>
      <p>Synthetic preview. Alt+K toggles keyboard space. Alt+B models touch scroll blur.</p>
      <AddVocabWordModal isOpen={open} onClose={() => setOpen(false)}
        onWordSaved={async () => ({ added: true, message: "Preview only" })}
        onRequireAuth={() => {}} onRequireSubscription={() => {}} isAuthenticated={true} />
    </div></div>
  </LanguageProvider>;
}
createRoot(document.getElementById("root")).render(<App />);
`;

await build({
  stdin: { contents: source, resolveDir: root, loader: "tsx" },
  bundle: true,
  outfile: join(output, "ui.js"),
  jsx: "automatic",
  nodePaths: [join(root, "node_modules")],
  tsconfig: join(root, "tsconfig.json"),
  plugins: [{
    name: "preview-fixtures",
    setup(builder) {
      builder.onResolve({ filter: /^@\/app\/actions$/ }, () => ({ path: "actions", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/lib\/supabase$/ }, () => ({ path: "supabase", namespace: "fixture" }));
      builder.onResolve({ filter: /^@\/hooks\/useUser$/ }, () => ({ path: "user", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        contents: path === "actions"
          ? `export async function translateDictionarySuggestion() {
              await new Promise((resolve) => setTimeout(resolve, 300));
              return { type: "success", translation: "Preview translation" };
            }
            export async function translateWord() { return { type: "error" }; }`
          : path === "user" ? `export function useUser() { return { user: null }; }`
          : `export const supabase = { auth: { getSession: async () => ({ data: { session: null } }) } };`,
        loader: "js",
      }));
    },
  }],
});

const word = {
  pealimId: 1, word: "מבחן", wordWithNekudot: "מִבְחָן", transliteration: "mivhan",
  partOfSpeech: "Noun", meaning: "test, examination", matchType: "headword", matchedText: "מבחן",
};
const entries = [word, ...Array.from({ length: 7 }, (_, index) => ({
  ...word,
  pealimId: index + 2,
  word: `מבחן${index + 2}`,
  wordWithNekudot: index === 0 ? "מִבְחָן".repeat(8) : `מִבְחָן${index + 2}`,
  transliteration: index === 0 ? "longpronunciationwithoutspacesthatmustwrapwithinthepopup" : `mivhan${index}`,
  meaning: index === 0
    ? "A long meaning that should remain completely readable without any cropped text inside the floating results list."
    : `Possible test meaning ${index}`,
  matchType: index === 0 ? "form" : "fuzzy",
  matchedText: index === 0 ? "מבחנים" : `מבחן${index + 2}`,
}))];
const requests = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  if (url.pathname === "/api/dictionary/suggest") {
    const direct = url.searchParams.get("mode") === "direct";
    const fail = url.searchParams.get("q") === "fail" && !direct;
    requests.push({ query: url.searchParams.get("q"), mode: url.searchParams.get("mode") });
    setTimeout(() => {
      response.writeHead(fail ? 503 : 200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(fail ? { status: "unavailable" } : {
        status: "success", suggestions: direct ? entries.slice(0, 2) : entries, needsCompletion: direct,
      }));
    }, direct ? 60 : 3000);
    return;
  }
  if (url.pathname === "/metrics") {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(requests));
    return;
  }
  if (["/ui.js", "/ui.css"].includes(url.pathname)) {
    response.setHeader("Content-Type", url.pathname.endsWith(".css") ? "text/css" : "text/javascript");
    response.end(await readFile(join(output, url.pathname.slice(1))));
    return;
  }
  response.setHeader("Content-Type", "text/html");
  response.end(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Vocabulary mobile preview</title><link rel="stylesheet" href="/ui.css">
    <div id="root"></div><script src="/ui.js"></script></html>`);
});
server.listen(port, "127.0.0.1", () => console.log(`Vocabulary mobile preview: http://localhost:${port}`));
