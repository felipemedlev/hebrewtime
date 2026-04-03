import json
import re
import requests
import time
import os

checkpoint_path = "episodes_checkpoint.json"
episodes_path = "episodes.json"

source_path = checkpoint_path if os.path.exists(checkpoint_path) else episodes_path

with open(source_path, "r", encoding="utf-8") as f:
    episodes = json.load(f)

updated = False
for ep in episodes:
    if ep.get("audio_url") and "drive.google.com/file/d/" in ep["audio_url"]:
        print(f"Fixing known old format in episode {ep['episode']}")
        match = re.search(r"d/([^/]+)/view", ep["audio_url"])
        if match:
            ep["audio_url"] = f"https://drive.google.com/uc?export=download&id={match.group(1)}"
            updated = True
    elif not ep.get("audio_url"):
        print(f"Episode {ep['episode']} is missing audio_url. Re-fetching...")
        url = ep["url"]
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
            
            audio_match = re.search(r"\"(https://[^\"]+\.mp3[^\"]*)\"", resp.text)
            if audio_match:
                ep["audio_url"] = audio_match.group(1)
                updated = True
            else:
                drive_match = re.search(r"href=\"https://drive\.google\.com/file/d/([^/]+)/view[^\"]*\"", resp.text)
                if drive_match:
                    ep["audio_url"] = f"https://drive.google.com/uc?export=download&id={drive_match.group(1)}"
                    updated = True
            time.sleep(1.5)
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")

if updated:
    with open(source_path, "w", encoding="utf-8") as f:
        json.dump(episodes, f, ensure_ascii=False, indent=2)
    print(f"{source_path} updated!")
else:
    print("No updates needed.")
