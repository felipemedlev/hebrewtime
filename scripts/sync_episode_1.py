import os
import json
import requests
from openai import OpenAI
from dotenv import load_dotenv
import difflib
from pathlib import Path

load_dotenv()

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def norm(text):
    return "".join(text.split()).lower()

def align_timestamps(original_paras, segments):
    """
    Aligns original paragraphs with Whisper segments.
    """
    aligned_paras = []
    
    # Create a full text from segments with character-to-segment mapping
    full_whisper_text = ""
    char_to_segment = [] # list of (char_start, char_end, segment_index)
    
    for i, seg in enumerate(segments):
        start_char = len(full_whisper_text)
        full_whisper_text += seg.text + " "
        end_char = len(full_whisper_text)
        char_to_segment.append((start_char, end_char, i))
    
    # Use SequenceMatcher to find the best match for each paragraph in the full text
    s = difflib.SequenceMatcher(None, full_whisper_text, "")
    
    current_search_start = 0
    
    for para_text in original_paras:
        # We search for the para_text in the full_whisper_text starting from current_search_start
        s.set_seq2(para_text)
        
        # Find the best match in the remaining text
        # This is a bit simplistic but works well for sequential transcripts
        match = s.find_longest_match(current_search_start, len(full_whisper_text), 0, len(para_text))
        
        if match.size < 10: # If match is too small, fallback to a simpler window search or just keep moving
             # Try a slightly broader search if the first one failed
             best_match = None
             best_ratio = 0
             search_window = 500 # chars
             for offset in range(max(0, current_search_start - 100), min(len(full_whisper_text), current_search_start + 1000)):
                 window = full_whisper_text[offset:offset+len(para_text)+50]
                 ratio = difflib.SequenceMatcher(None, window, para_text).ratio()
                 if ratio > best_ratio:
                     best_ratio = ratio
                     best_match = (offset, offset + len(para_text))
                 if ratio > 0.9: break
             
             if best_ratio > 0.5:
                 start_idx, end_idx = best_match
             else:
                 # Fallback: just take the next few seconds from where we are
                 start_idx = current_search_start
                 end_idx = current_search_start + len(para_text)
        else:
            start_idx = match.a
            end_idx = match.a + match.size
            
        # Map char indices back to segments to get times
        start_time = None
        end_time = None
        
        for cs, ce, si in char_to_segment:
            if cs <= start_idx < ce:
                start_time = segments[si].start
            if cs <= end_idx <= ce:
                end_time = segments[si].end
        
        if start_time is None: start_time = segments[0].start
        if end_time is None: end_time = segments[-1].end
        
        # Ensure monotonicity
        if aligned_paras and start_time < aligned_paras[-1]['end']:
            start_time = aligned_paras[-1]['end']
        if end_time < start_time:
            end_time = start_time + 5.0 # default 5s
            
        aligned_paras.append({
            "text": para_text,
            "start": round(float(start_time), 2),
            "end": round(float(end_time), 2)
        })
        
        current_search_start = end_idx

    return aligned_paras

def main():
    with open("episodes.json", "r", encoding="utf-8") as f:
        episodes = json.load(f)
    
    ep1 = next((ep for ep in episodes if ep['episode'] == 1), None)
    if not ep1:
        print("Episode 1 not found!")
        return

    audio_url = ep1['audio_url']
    print(f"Downloading audio from {audio_url}...")
    audio_path = "episode_1_temp.mp3"
    resp = requests.get(audio_url)
    with open(audio_path, "wb") as f:
        f.write(resp.content)
    
    print("Transcribing with Whisper...")
    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            file=audio_file,
            model="whisper-1",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
            language="he" # Explicitly Hebrew
        )
    
    segments = transcript.segments
    original_paras = ep1['hebrew_paragraphs']
    
    print("Aligning timestamps...")
    # Basic paragraph items were just strings, now they will be objects
    # We only update if they are still strings (or if we want to overwrite)
    new_paras = align_timestamps(original_paras, segments)
    
    ep1['hebrew_paragraphs'] = new_paras
    
    print("Saving updated episodes.json...")
    with open("episodes.json", "w", encoding="utf-8") as f:
        json.dump(episodes, f, ensure_ascii=False, indent=2)
    
    os.remove(audio_path)
    print("Done! Episode 1 synchronized.")

if __name__ == "__main__":
    main()
