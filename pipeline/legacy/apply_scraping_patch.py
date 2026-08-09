#!/usr/bin/env python3
"""
Patch missing paragraphs in episodes.json by finding new paragraphs 
and translating only the missing parts using difflib.
"""
import json
import time
import os
import shutil
from datetime import datetime, timezone
from openai import OpenAI
import difflib

import scraper

def patch_episodes():
    openai_key = os.environ.get("OPENAI_API_KEY")
    if not openai_key:
        print("Missing OPENAI_API_KEY")
        return

    client = OpenAI(api_key=openai_key)
    episodes_path = "episodes.json"
    
    with open(episodes_path, "r", encoding="utf-8") as f:
        episodes = json.load(f)
        
    patched_count = 0
    total_translated = 0
        
    for ep in episodes:
        old_hebrew = ep.get("hebrew_paragraphs", [])
        new_ep = scraper.fetch_episode(ep["episode"])
        if not new_ep:
            continue
            
        new_hebrew = new_ep["hebrew_paragraphs"]
        if len(new_hebrew) > len(old_hebrew):
            print(f"Episode {ep['episode']} has {len(new_hebrew) - len(old_hebrew)} new paragraphs. Patching...")
            
            sm = difflib.SequenceMatcher(
                None, 
                [scraper.norm(p) for p in old_hebrew], 
                [scraper.norm(p) for p in new_hebrew]
            )
            
            new_english = []
            old_english = ep.get("english_paragraphs", [])
            old_idx = 0
            
            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == "equal":
                    for _ in range(i1, i2):
                        if old_idx < len(old_english):
                            new_english.append(old_english[old_idx])
                        else:
                            new_english.append("")
                        old_idx += 1
                elif tag == "insert":
                    for j in range(j1, j2):
                        p = new_hebrew[j]
                        if p.strip():
                            print(f"  Translating: {p[:50]}...")
                            try:
                                resp = client.chat.completions.create(
                                    model="gpt-5.4-mini",
                                    messages=[
                                        {"role": "system", "content": "You are a professional Hebrew-to-English translator. Translate the following Modern Hebrew paragraph naturally and accurately. Preserve paragraph structure. Output ONLY the English translation."},
                                        {"role": "user", "content": p}
                                    ],
                                    temperature=0.2
                                )
                                new_english.append(resp.choices[0].message.content.strip())
                                total_translated += 1
                            except Exception as e:
                                print(f"  Error: {e}")
                                new_english.append("[translation error]")
                            time.sleep(0.5)
                        else:
                            new_english.append("")
                elif tag == "replace":
                    # Replaced paragraphs, let's just skip translation logic for now or rely on old english.
                    # We assume mostly insertions.
                    for j in range(j1, j2):
                        new_english.append("[replaced content - translation missing]")
                        
            ep["hebrew_paragraphs"] = new_hebrew
            ep["english_paragraphs"] = new_english
            ep["hebrew_text"] = "\n\n".join(new_hebrew)
            patched_count += 1
            
    if patched_count > 0:
        backup_path = f"episodes.json.bak.{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
        print(f"Backing up to {backup_path}")
        shutil.copy2(episodes_path, backup_path)
        
        with open(episodes_path, "w", encoding="utf-8") as f:
            json.dump(episodes, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully patched {patched_count} episodes. Translated {total_translated} new paragraphs.")
    else:
        print("No missing paragraphs found across all episodes.")

if __name__ == "__main__":
    patch_episodes()
