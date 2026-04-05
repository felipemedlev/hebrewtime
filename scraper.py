#!/usr/bin/env python3
"""
Hebrew Time Podcast Scraper + Translator
Scrapes all episodes from hebrewtime.squarespace.com and translates them using OpenAI.
Generates a self-contained HTML reader file.

Requirements:
    pip install requests beautifulsoup4 openai

Usage:
    python scrape_translate.py
"""

import json
import time
import re
import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()  # loads .env from current directory

import requests
from bs4 import BeautifulSoup

# ── CONFIG ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
BASE_URL = "https://hebrewtime.squarespace.com/episodes/{:02d}"
TOTAL_EPISODES = 50
DELAY_BETWEEN_REQUESTS = 1.5   # seconds — be polite to the server
OUTPUT_JSON = "episodes.json"
OUTPUT_HTML = "hebrew_reader.html"
# ─────────────────────────────────────────────────────────────────────────────


def norm(s: str) -> str:
    # Whitespace-only differences are common across HTML extraction strategies.
    return " ".join((s or "").split()).strip()


def fetch_episode(episode_num: int) -> dict | None:
    """Fetch and parse a single episode page."""
    url = BASE_URL.format(episode_num)
    try:
        resp = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; HebrewTimeScraper/1.0)"
        })
        if resp.status_code == 404:
            print(f"  Episode {episode_num:02d}: 404 — skipping")
            return None
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  Episode {episode_num:02d}: fetch error — {e}")
        return None

    soup = BeautifulSoup(resp.text, "html.parser")

    # ── Title ─────────────────────────────────────────────────────────────────
    title_tag = soup.find("h1")
    title = title_tag.get_text(strip=True) if title_tag else f"Episode {episode_num:02d}"

    # Normalize formats like "[20] Title" to "Episode 20: Title"
    match = re.match(r"^\[(\d+)\]\s*(.*)", title)
    if match:
        title = f"Episode {match.group(1)}: {match.group(2)}"

    # ── Main content ──────────────────────────────────────────────────────────
    # Squarespace stores body content inside article tags, main, or .sqs-block-content
    content_block = (
        soup.find("article")
        or soup.find("main")
        or soup.find("div", class_=re.compile(r"sqs-block-content"))
    )

    if content_block:
        # Remove image captions and nav cruft
        for tag in content_block.find_all(["figure", "figcaption", "nav"]):
            tag.decompose()
        # Preserve the original segmentation strategy (extract all non-empty <p> tags
        # inside the main article) but fix the specific case where the first transcript
        # paragraph is rendered as leading text nodes before the first <p>.
        paragraphs = [p.get_text(strip=True) for p in content_block.find_all("p") if p.get_text(strip=True)]

        # Identify the transcript block that contains the current first paragraph,
        # then extract any leading text nodes that appear before the first non-empty <p>.
        lead_text = ""
        if paragraphs:
            first_para_norm = norm(paragraphs[0])
            candidates = content_block.find_all(
                "div", class_=re.compile(r"\bsqs-block-content\b")
            )

            best_score = -1
            transcript_root = None
            for cand in candidates:
                cand_text_norm = norm(cand.get_text(" ", strip=True))
                # Strongly prefer the block that contains the first extracted paragraph.
                score = cand_text_norm.count(first_para_norm) * 1000
                # Then prefer blocks with more <p> tags.
                score += sum(1 for p in cand.find_all("p") if p.get_text(" ", strip=True))
                if score > best_score:
                    best_score = score
                    transcript_root = cand

            if transcript_root is not None:
                p_tags = transcript_root.find_all("p")
                first_non_empty_p = next(
                    (p for p in p_tags if p.get_text(" ", strip=True)), None
                )
                if first_non_empty_p is not None:
                    lead_parts: list[str] = []
                    for el in transcript_root.descendants:
                        if el is first_non_empty_p:
                            break
                        if getattr(el, "name", None) is None:
                            s = str(el).strip()
                            if s:
                                lead_parts.append(s)
                    lead_text = " ".join(lead_parts).strip()

        if lead_text:
            # Only prepend if it isn't already part of the extracted <p> paragraphs.
            if not any(norm(p) == norm(lead_text) for p in paragraphs):
                paragraphs.insert(0, lead_text)
    else:
        paragraphs = []

    if not paragraphs:
        print(f"  Episode {episode_num:02d}: no paragraphs found — skipping")
        return None

    hebrew_text = "\n\n".join(paragraphs)
    print(f"  Episode {episode_num:02d}: ✓ scraped ({len(paragraphs)} paragraphs)")

    # ── Audio URL ─────────────────────────────────────────────────────────────
    audio_match = re.search(r"\"(https://[^\"]+\.mp3[^\"]*)\"", resp.text)
    if audio_match:
        audio_url = audio_match.group(1)
    else:
        # Fallback to Google Drive links (e.g. episodic 12, 13)
        drive_match = re.search(r"href=\"https://drive\.google\.com/file/d/([^/]+)/view[^\"]*\"", resp.text)
        if drive_match:
            file_id = drive_match.group(1)
            audio_url = f"https://drive.google.com/uc?export=download&id={file_id}"
        else:
            audio_url = None

    return {
        "episode": episode_num,
        "url": url,
        "title": title,
        "audio_url": audio_url,
        "hebrew_paragraphs": paragraphs,
        "hebrew_text": hebrew_text,
        "english_paragraphs": [],   # filled in next step
    }


def translate_episode(episode: dict) -> dict:
    """Translate Hebrew paragraphs to English using OpenAI."""
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)

    translated = []
    for i, para in enumerate(episode["hebrew_paragraphs"]):
        if not para.strip():
            translated.append("")
            continue
        try:
            response = client.chat.completions.create(
                model="gpt-5.4-mini",   # fast + cheap, great for translation
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a professional Hebrew-to-English translator. "
                            "Translate the following Modern Hebrew paragraph naturally and accurately. "
                            "Preserve paragraph structure. Output ONLY the English translation."
                        ),
                    },
                    {"role": "user", "content": para},
                ],
                temperature=0.2,
            )
            english = response.choices[0].message.content.strip()
            translated.append(english)
        except Exception as e:
            print(f"    Translation error (ep {episode['episode']:02d}, para {i}): {e}")
            translated.append("[translation error]")

    episode["english_paragraphs"] = translated
    print(f"  Episode {episode['episode']:02d}: ✓ translated")
    return episode


def scrape_all() -> list[dict]:
    """Scrape all episodes, with resume support via checkpoint file."""
    checkpoint = Path("episodes_checkpoint.json")
    if checkpoint.exists():
        with open(checkpoint) as f:
            done = {ep["episode"]: ep for ep in json.load(f)}
        print(f"Resuming — {len(done)} episodes already scraped.\n")
    else:
        done = {}

    for n in range(1, TOTAL_EPISODES + 1):
        if n in done:
            continue
        print(f"Fetching episode {n:02d}...")
        ep = fetch_episode(n)
        if ep:
            done[n] = ep
            # Save checkpoint after each episode
            with open(checkpoint, "w", encoding="utf-8") as f:
                json.dump(list(done.values()), f, ensure_ascii=False, indent=2)
        time.sleep(DELAY_BETWEEN_REQUESTS)

    return sorted(done.values(), key=lambda e: e["episode"])


def translate_all(episodes: list[dict]) -> list[dict]:
    """Translate any episodes missing English translations."""
    checkpoint = Path("episodes_checkpoint.json")
    updated = []
    for ep in episodes:
        if ep.get("english_paragraphs"):
            updated.append(ep)
            continue
        print(f"Translating episode {ep['episode']:02d}...")
        ep = translate_episode(ep)
        updated.append(ep)
        # Save checkpoint
        with open(checkpoint, "w", encoding="utf-8") as f:
            json.dump(updated + [e for e in episodes if e not in updated],
                      f, ensure_ascii=False, indent=2)
        time.sleep(0.5)
    return updated


def generate_html(episodes: list[dict]) -> str:
    """Generate a self-contained HTML reader with embedded episode data."""
    episodes_json = json.dumps(episodes, ensure_ascii=False)

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hebrew Time — Bilingual Reader</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
  /* ── Reset & Base ── */
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

  :root {{
    --bg:        #f7f4ee;
    --surface:   #ffffff;
    --border:    #e0dbd0;
    --accent:    #2d5a3d;
    --accent2:   #8b5e3c;
    --text:      #1a1a18;
    --muted:     #7a7568;
    --hebrew-bg: #f0ede6;
    --en-bg:     #ffffff;
    --tag-bg:    #e8f0eb;
    --shadow:    0 2px 24px rgba(0,0,0,0.06);
    --radius:    4px;
  }}

  html {{ font-size: 16px; scroll-behavior: smooth; }}
  body {{
    background: var(--bg);
    color: var(--text);
    font-family: 'EB Garamond', Georgia, serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }}

  /* ── Header ── */
  header {{
    background: var(--accent);
    color: #fff;
    padding: 1.5rem 2.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 1px 12px rgba(0,0,0,0.15);
  }}
  header h1 {{
    font-family: 'Playfair Display', serif;
    font-size: 1.4rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }}
  header span {{
    font-size: 0.85rem;
    opacity: 0.7;
    font-style: italic;
  }}

  /* ── Layout ── */
  .app {{ display: flex; flex: 1; height: calc(100vh - 64px); overflow: hidden; }}

  /* ── Sidebar ── */
  .sidebar {{
    width: 260px;
    min-width: 220px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    overflow-y: auto;
    flex-shrink: 0;
  }}
  .sidebar-header {{
    padding: 1rem 1.2rem 0.6rem;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 10;
  }}
  .sidebar-header input {{
    width: 100%;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.85rem;
    background: var(--bg);
    color: var(--text);
    outline: none;
    transition: border-color 0.15s;
  }}
  .sidebar-header input:focus {{ border-color: var(--accent); }}

  .ep-list {{ padding: 0.5rem 0; }}
  .ep-item {{
    padding: 0.65rem 1.2rem;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: background 0.12s, border-color 0.12s;
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }}
  .ep-item:hover {{ background: var(--bg); }}
  .ep-item.active {{
    background: var(--tag-bg);
    border-left-color: var(--accent);
  }}
  .ep-num {{
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--accent);
    font-family: 'Playfair Display', serif;
    min-width: 24px;
  }}
  .ep-title {{
    font-size: 0.82rem;
    color: var(--muted);
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}

  /* ── Main content ── */
  .content {{
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }}

  .episode-header {{
    padding: 2rem 2.5rem 1.5rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }}
  .episode-header .ep-badge {{
    display: inline-block;
    background: var(--tag-bg);
    color: var(--accent);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.2rem 0.6rem;
    border-radius: 2px;
    margin-bottom: 0.6rem;
  }}
  .episode-header h2 {{
    font-family: 'Playfair Display', serif;
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text);
  }}
  .episode-header a {{
    font-size: 0.78rem;
    color: var(--muted);
    text-decoration: none;
    margin-top: 0.5rem;
    display: inline-block;
    transition: color 0.15s;
  }}
  .episode-header a:hover {{ color: var(--accent); }}

  /* Column labels */
  .col-labels {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }}
  .col-label {{
    padding: 0.5rem 2rem;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }}
  .col-label.hebrew {{ border-right: 1px solid var(--border); }}

  /* Paragraph pairs */
  .paragraphs {{ flex: 1; }}
  .para-pair {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }}
  .para-pair:hover {{ background: rgba(45,90,61,0.02); }}
  .para-pair:last-child {{ border-bottom: none; }}

  .para-cell {{
    padding: 1.4rem 2rem;
    font-size: 1.05rem;
    line-height: 1.8;
    color: var(--text);
  }}
  .para-cell.hebrew-cell {{
    direction: rtl;
    text-align: right;
    background: var(--hebrew-bg);
    border-right: 1px solid var(--border);
    font-size: 1.1rem;
  }}
  .para-cell.english-cell {{
    background: var(--en-bg);
    color: #2a2a28;
    font-style: italic;
  }}

  /* Empty state */
  .empty-state {{
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted);
    gap: 0.5rem;
    padding: 3rem;
    text-align: center;
  }}
  .empty-state .big {{ font-family: 'Playfair Display', serif; font-size: 3rem; opacity: 0.15; }}
  .empty-state p {{ font-style: italic; font-size: 1rem; }}

  /* Scrollbar */
  ::-webkit-scrollbar {{ width: 5px; }}
  ::-webkit-scrollbar-track {{ background: transparent; }}
  ::-webkit-scrollbar-thumb {{ background: var(--border); border-radius: 3px; }}

  /* Responsive */
  @media (max-width: 900px) {{
    .sidebar {{ width: 200px; }}
    .para-cell {{ padding: 1rem 1.2rem; font-size: 0.95rem; }}
    .episode-header {{ padding: 1.2rem 1.4rem; }}
    .col-label {{ padding: 0.5rem 1.2rem; }}
  }}
  @media (max-width: 640px) {{
    .app {{ flex-direction: column; height: auto; overflow: visible; }}
    .sidebar {{ width: 100%; height: 200px; border-right: none; border-bottom: 1px solid var(--border); }}
    .col-labels, .para-pair {{ grid-template-columns: 1fr; }}
    .para-cell.hebrew-cell {{ border-right: none; border-bottom: 1px solid var(--border); }}
  }}
</style>
</head>
<body>

<header>
  <h1>🕐 Hebrew Time</h1>
  <span>Bilingual Reader</span>
</header>

<div class="app">
  <aside class="sidebar">
    <div class="sidebar-header">
      <input type="text" id="search" placeholder="Search episodes…" oninput="filterEpisodes(this.value)">
    </div>
    <div class="ep-list" id="ep-list"></div>
  </aside>

  <main class="content" id="main-content">
    <div class="empty-state">
      <div class="big">עברית</div>
      <p>Select an episode to start reading</p>
    </div>
  </main>
</div>

<script>
const EPISODES = {episodes_json};

let currentEp = null;

function renderSidebar(episodes) {{
  const list = document.getElementById('ep-list');
  list.innerHTML = episodes.map(ep => `
    <div class="ep-item${{ep.episode === currentEp ? ' active' : ''}}" onclick="loadEpisode(${{ep.episode}})" data-ep="${{ep.episode}}">
      <span class="ep-num">${{String(ep.episode).padStart(2,'0')}}</span>
      <span class="ep-title">${{ep.title.replace(/Episode \\d+:?\\s*/i,'').split('–')[0].split('-')[0].trim()}}</span>
    </div>
  `).join('');
}}

function filterEpisodes(query) {{
  const q = query.toLowerCase();
  const filtered = q
    ? EPISODES.filter(ep => ep.title.toLowerCase().includes(q) || ep.hebrew_text?.toLowerCase().includes(q))
    : EPISODES;
  renderSidebar(filtered);
}}

function loadEpisode(num) {{
  currentEp = num;
  const ep = EPISODES.find(e => e.episode === num);
  if (!ep) return;

  // Update sidebar active state
  document.querySelectorAll('.ep-item').forEach(el => {{
    el.classList.toggle('active', parseInt(el.dataset.ep) === num);
  }});

  const pairs = ep.hebrew_paragraphs.map((heb, i) => {{
    const eng = ep.english_paragraphs?.[i] || '<em style="color:#aaa">No translation</em>';
    return `
      <div class="para-pair">
        <div class="para-cell hebrew-cell">${{heb}}</div>
        <div class="para-cell english-cell">${{eng}}</div>
      </div>`;
  }}).join('');

  document.getElementById('main-content').innerHTML = `
    <div class="episode-header">
      <div class="ep-badge">Episode ${{String(ep.episode).padStart(2,'0')}}</div>
      <h2>${{ep.title}}</h2>
      <a href="${{ep.url}}" target="_blank" rel="noopener">↗ View original on hebrewtime.squarespace.com</a>
    </div>
    <div class="col-labels">
      <div class="col-label hebrew">עברית — Hebrew</div>
      <div class="col-label">English</div>
    </div>
    <div class="paragraphs">${{pairs}}</div>
  `;

  document.getElementById('main-content').scrollTo(0, 0);
}}

// Init
renderSidebar(EPISODES);
if (EPISODES.length > 0) loadEpisode(EPISODES[0].episode);
</script>
</body>
</html>'''
    return html


def main():
    print("═" * 55)
    print("  Hebrew Time — Scraper & Translator")
    print("═" * 55)

    if not OPENAI_API_KEY:
        print("\n⚠️  No OPENAI_API_KEY found. Make sure your .env file contains:")
        print("   OPENAI_API_KEY=sk-...\n")

    # Step 1: Scrape
    print("\n[1/3] Scraping episodes…")
    episodes = scrape_all()
    print(f"\n✓ Scraped {len(episodes)} episodes.")

    # Step 2: Translate
    if OPENAI_API_KEY:
        print("\n[2/3] Translating…")
        episodes = translate_all(episodes)
        print(f"\n✓ Translation complete.")
    else:
        print("\n[2/3] Skipping translation (no API key set).")

    # Step 3: Save JSON
    print(f"\n[3/3] Saving {OUTPUT_JSON}…")
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(episodes, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {OUTPUT_JSON}")

    # Step 4: Generate HTML
    print(f"      Generating {OUTPUT_HTML}…")
    html = generate_html(episodes)
    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✓ Saved {OUTPUT_HTML}")

    print("\n" + "═" * 55)
    print(f"  Done! Open {OUTPUT_HTML} in your browser.")
    print("═" * 55)


if __name__ == "__main__":
    main()