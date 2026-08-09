#!/usr/bin/env python3
"""Generate different levels episodes: script -> TTS -> align -> upload -> DB."""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from openai import BadRequestError, OpenAI
from pydub import AudioSegment

PIPELINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE_DIR))

from lib.alignment import split_hebrew_sentences  # noqa: E402
from lib.paths import (  # noqa: E402
    CHECKPOINT_DIR,
    DEFAULT_CREDENTIALS_CANDIDATES,
    ENV_PATH,
    PIPELINE_DIR as _PIPELINE_DIR,
    REPO_ROOT,
    default_script_bank_path,
    list_curriculum_levels,
    resolve_curriculum_path,
)
from lib.translation_utils import build_translations_map  # noqa: E402

load_dotenv(ENV_PATH)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
AUDIO_BUCKET = os.environ.get("SUPABASE_AUDIO_BUCKET", "episode-audio")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

DEFAULT_TTS_MODEL = "gemini-3.1-flash-tts-preview"

def resolve_credentials_path() -> Path | None:
    raw = (
        os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        or os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
        or ""
    ).strip().strip('"').strip("'")

    candidates: list[Path] = []

    if raw:
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = (REPO_ROOT / path).resolve()
        candidates.append(path)

        # Common mistake: path truncated before "hebrewtime" when unquoted in shell
        if path.is_dir():
            candidates.append(path / "hebrewtime" / "secrets" / "gcp-service-account.json")
            candidates.append(path / "hebrewtime" / "gcp-service-account.json")

    candidates.extend(DEFAULT_CREDENTIALS_CANDIDATES)

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    if raw:
        path = Path(raw).expanduser()
        if not path.is_absolute():
            path = (REPO_ROOT / path).resolve()

        if path.is_dir():
            json_files = sorted(path.glob("*.json"))
            raise SystemExit(
                "GOOGLE_APPLICATION_CREDENTIALS must be a service account JSON file, not a directory.\n"
                f"Current value points to directory: {path}\n"
                "Download a key from GCP (IAM → Service Accounts → Keys) and set e.g.:\n"
                f'GOOGLE_APPLICATION_CREDENTIALS="{REPO_ROOT / "secrets" / "gcp-service-account.json"}"\n'
                + (
                    f"JSON files found in that directory: {[f.name for f in json_files]}\n"
                    if json_files
                    else "No .json files found in that directory.\n"
                )
            )

        raise SystemExit(
            "Google service account JSON not found.\n"
            f"Configured path: {path}\n"
            "Set GOOGLE_APPLICATION_CREDENTIALS to the downloaded key file path."
        )

    return None


def load_service_account_info() -> dict:
    path = resolve_credentials_path()
    if not path:
        raise SystemExit(
            "Google service account JSON not found. "
            f'Set GOOGLE_APPLICATION_CREDENTIALS="{REPO_ROOT / "secrets" / "gcp-service-account.json"}"'
        )
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def ensure_gcp_env() -> tuple[str, str]:
    """Set ADC env vars and return (project_id, client_email)."""
    path = resolve_credentials_path()
    if not path:
        raise SystemExit("Missing GOOGLE_APPLICATION_CREDENTIALS")

    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(path)
    info = load_service_account_info()
    project_id = info.get("project_id") or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
    client_email = info.get("client_email", "")

    if project_id:
        os.environ.setdefault("GOOGLE_CLOUD_PROJECT", project_id)

    return project_id, client_email


def format_tts_permission_error(project_id: str, client_email: str, detail: str) -> str:
    return (
        "Gemini TTS failed: 403 PERMISSION_DENIED — Vertex AI access required.\n"
        f"Service account: {client_email or '(unknown)'}\n"
        f"Project ID: {project_id or '(unknown)'}\n\n"
        "Required setup (same GCP project as the JSON key):\n"
        "  1. Enable APIs: Cloud Text-to-Speech + Vertex AI (aiplatform.googleapis.com)\n"
        "  2. Grant THIS service account: Vertex AI User (roles/aiplatform.user)\n"
        "     (Editor / Text-to-Speech User alone is NOT enough for Gemini models)\n"
        f"     gcloud services enable texttospeech.googleapis.com aiplatform.googleapis.com --project={project_id}\n"
        f"     gcloud projects add-iam-policy-binding {project_id} \\\n"
        f"       --member='serviceAccount:{client_email}' \\\n"
        "       --role='roles/aiplatform.user'\n"
        "  3. Billing enabled on the project\n"
        "  4. Wait ~1–2 min, then: python3 pipeline/verify_gcp_tts.py\n\n"
        f"Raw error: {detail}"
    )



def service_headers(extra: dict | None = None) -> dict:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise SystemExit("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
    }
    if extra:
        h.update(extra)
    return h


def load_curriculum(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def load_script_bank(path: Path) -> dict:
    if path.exists():
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    return {"version": 1, "level": None, "episodes": []}


def save_script_bank(path: Path, bank: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(bank, f, ensure_ascii=False, indent=2)


def get_script_from_bank(bank: dict, episode_number: int) -> dict | None:
    for episode in bank.get("episodes", []):
        if int(episode.get("episode_number", -1)) == episode_number:
            return episode.get("script")
    return None


def upsert_script_in_bank(
    bank: dict,
    *,
    level: str,
    episode_cfg: dict,
    script: dict,
) -> None:
    episode_number = int(episode_cfg["episode_number"])
    bank["level"] = level
    bank.setdefault("episodes", [])

    entry = {
        "episode_number": episode_number,
        "title_en": episode_cfg.get("title_en"),
        "topic": episode_cfg.get("topic"),
        "narrative_hook": episode_cfg.get("narrative_hook"),
        "new_vocab": episode_cfg.get("new_vocab", []),
        "review_vocab": episode_cfg.get("review_vocab", []),
        "useful_phrases": episode_cfg.get("useful_phrases", []),
        "word_count": count_hebrew_words(script.get("hebrew_paragraphs", [])),
        "paragraph_count": len(script.get("hebrew_paragraphs", [])),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "script": script,
    }

    for idx, existing in enumerate(bank["episodes"]):
        if int(existing.get("episode_number", -1)) == episode_number:
            bank["episodes"][idx] = entry
            break
    else:
        bank["episodes"].append(entry)

    bank["episodes"].sort(key=lambda ep: int(ep["episode_number"]))


def build_previous_episode_context(bank: dict, episode_number: int, narrator_name: str = "Narrator") -> str:
    previous = [
        ep for ep in bank.get("episodes", [])
        if int(ep.get("episode_number", 0)) < episode_number and ep.get("script")
    ]
    if not previous:
        return "No previous generated episodes yet."

    recent = previous[-3:]
    lines = [
        f"Use these already-generated episodes as continuity context. Keep {narrator_name}'s voice, avoid repeating the same anecdotes, and reuse useful vocabulary naturally."
    ]
    for ep in recent:
        script = ep["script"]
        hebrew_paragraphs = script.get("hebrew_paragraphs", [])
        first_scene = hebrew_paragraphs[0] if hebrew_paragraphs else ""
        closing = hebrew_paragraphs[-1] if hebrew_paragraphs else ""
        useful = ", ".join(ep.get("useful_phrases", [])[:5])
        vocab = ", ".join((ep.get("new_vocab", []) + ep.get("review_vocab", []))[:12])
        lines.append(
            f"- Episode {ep['episode_number']}: {script.get('title', ep.get('title_en', ''))}\n"
            f"  Topic: {ep.get('topic', '')}\n"
            f"  Opening scene: {first_scene[:260]}\n"
            f"  Closing note: {closing[:220]}\n"
            f"  Useful phrases: {useful}\n"
            f"  Vocab to reinforce later: {vocab}"
        )
    return "\n".join(lines)


def checkpoint_path(level: str, episode_number: int) -> Path:
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    return CHECKPOINT_DIR / f"{level}-{episode_number:02d}.json"


def checkpoint_audio_path(level: str, episode_number: int) -> Path:
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    return CHECKPOINT_DIR / f"{level}-{episode_number:02d}.mp3"


def load_checkpoint(level: str, episode_number: int) -> dict:
    path = checkpoint_path(level, episode_number)
    if path.exists():
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_checkpoint(level: str, episode_number: int, data: dict) -> None:
    path = checkpoint_path(level, episode_number)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def episode_exists(level: str, episode_number: int) -> bool:
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/episodes?select=id&level_slug=eq.{level}&episode_number=eq.{episode_number}&limit=1",
        headers=service_headers({"Content-Type": "application/json"}),
        timeout=30,
    )
    if not res.ok:
        return False
    return len(res.json()) > 0


def count_hebrew_words(paragraphs: list[str]) -> int:
    return sum(len(p.split()) for p in paragraphs)


def create_script_completion(
    client: OpenAI,
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
):
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"}
    }

    try:
        return client.chat.completions.create(**payload)
    except BadRequestError as exc:
        message = str(exc)
        if "temperature" not in message or "unsupported" not in message.lower():
            raise

        print(
            f"  Model {model} does not support custom temperature; "
            "retrying with default temperature."
        )
        payload.pop("temperature", None)
        return client.chat.completions.create(**payload)


def generate_script(
    client: OpenAI,
    curriculum: dict,
    episode_cfg: dict,
    previous_context: str = "No previous generated episodes yet.",
    script_model: str | None = None,
) -> dict:
    narrator = curriculum["narrator"]
    gen = curriculum.get("generation", {})
    model = script_model or gen.get("openai_model", "gpt-5.4")
    target_paragraphs = gen.get("target_paragraph_count", 40)
    word_min = gen.get("target_word_count_min", 850)
    word_max = gen.get("target_word_count_max", 1000)
    target_minutes = gen.get("target_duration_minutes", 10)
    core_vocab = gen.get("core_vocab", [])
    useful_chunks = gen.get("useful_chunks", [])
    style_rules = gen.get("style_rules", [])
    level_name = curriculum.get("display", {}).get("name") or curriculum.get("level", "beginner")
    
    level_slug = curriculum.get("level", "beginner")
    if "advanced" in level_slug.lower():
        fallback_desc = "advanced Hebrew with rich vocabulary, idiomatic expressions, complex grammatical structures, and cultural nuances"
        fallback_lang = "Natural, standard spoken Hebrew at a normal native speed and rhythm, utilizing advanced expressions, logical connectors, and cultural references"
        fallback_vocab = "Introduce advanced level vocabulary, idioms, and expressions naturally, encouraging learning through immersion and context."
        sentence_guidance = "Rich and diverse vocabulary; complex sentences and natural native phrasing"
    elif "intermediate" in level_slug.lower():
        fallback_desc = "intermediate Hebrew for learners who know basic daily vocabulary and are ready for richer connectors, opinions, short explanations, and more natural spoken phrasing"
        fallback_lang = "Modern spoken Hebrew with natural connectors, simple subordinate clauses, useful past/future forms, and occasional common idioms explained through context"
        fallback_vocab = "Introduce a focused set of intermediate words and phrases, making sure the overall story remains understandable through context."
        sentence_guidance = "Intermediate vocabulary; natural sentence length with logical connectors"
    else:
        fallback_desc = "beginner-friendly Hebrew with high-frequency vocabulary and simple grammar"
        fallback_lang = "Modern spoken Hebrew, slow and clear, beginner-friendly grammar"
        fallback_vocab = "Introduce only a small number of new beginner words; make most of the episode understandable through already-known/core words."
        sentence_guidance = "High-frequency vocabulary; short sentences"

    level_description = gen.get("level_description", fallback_desc)
    narrator_name = narrator["name"]
    narrator_instruction = gen.get(
        "narrator_instruction",
        f"First person, conversational, warm, personal — as if {narrator_name} is talking to a friend",
    )
    language_guidance = gen.get("language_guidance", fallback_lang)
    vocabulary_guidance = gen.get("vocabulary_guidance", fallback_vocab)

    review = episode_cfg.get("review_vocab") or []
    new_vocab = episode_cfg.get("new_vocab") or []
    useful_phrases = episode_cfg.get("useful_phrases") or []
    narrative_hook = episode_cfg.get("narrative_hook") or episode_cfg["topic"]

    style_rules_block = "\n".join(f"- {rule}" for rule in style_rules)

    system_prompt = f"""You are a Hebrew language content writer creating {level_name} podcast scripts.

Narrator persona: {narrator['persona']}
Narrator name: {narrator['name']} ({narrator.get('name_hebrew', '')})
Learning level: {level_description}

Write a ~{target_minutes}-minute spoken Hebrew monologue for episode {episode_cfg['episode_number']}.
Topic: {episode_cfg['topic']}
Title (English): {episode_cfg.get('title_en', episode_cfg['topic'])}
Narrative hook: {narrative_hook}

Previous episode context:
{previous_context}

Length requirements (critical):
- Total Hebrew word count: {word_min}–{word_max} words across all paragraphs
- Aim for ~{target_paragraphs} short paragraphs (2–4 sentences each)
- When read aloud slowly for learners, this should fill about {target_minutes} minutes

Requirements:
- {narrator_instruction}
- {language_guidance}
- {sentence_guidance}
- Include and naturally reuse these review words: {', '.join(review) if review else 'none'}
- Introduce these new words naturally: {', '.join(new_vocab) if new_vocab else 'review only'}
- Keep these high-frequency words active throughout the episode: {', '.join(core_vocab)}
- Naturally include these useful conversational chunks when relevant: {', '.join(useful_chunks)}
- Episode-specific useful phrases to include and reinforce: {', '.join(useful_phrases) if useful_phrases else 'none'}
- Each paragraph: 2-4 sentences max, separated for TTS
- Expand with personal anecdotes, sensory detail, and gentle repetition — do NOT be brief
- Make the episode interesting: include a tiny real-life problem, choice, surprise, or emotion.
- Use concrete everyday details (time of day, place, people, sounds, smells, small actions).
- Vary sentence openings so the script does not sound like a textbook pattern drill.
- Do not explain grammar directly unless {narrator_name} says one short, natural learner-friendly note.
- Maintain strong continuity with previous episodes: {narrator_name} must sound like the exact same person, continuing their personal journey. Refer back to earlier life events, jokes, or vocabulary naturally.
- CRITICAL: Never repeat the same stories, situations, or anecdotes that were already told in previous episodes. Treat this as a serial podcast where each episode has a unique, fresh daily slice-of-life scene.
- Fun and engaging podcast narration: The monologue should feel like a warm, interesting, and personal chat with a friend over coffee, filled with small, relatable, and fun life observations. It should NOT feel like a dry textbook exercise, grammar drill, or a list of sentences.
- {vocabulary_guidance}
- No stage directions, no markdown, no bullet lists in Hebrew text

Style rules:
{style_rules_block}

Return JSON with exactly:
{{
  "title": "Episode NN: English title — Hebrew subtitle",
  "hebrew_paragraphs": ["...", "..."],
  "english_paragraphs": ["...", "..."]
}}
english_paragraphs must align 1:1 with hebrew_paragraphs (same count)."""

    user_prompt = (
        f"Write episode {episode_cfg['episode_number']} about: {episode_cfg['topic']}. "
        f"Use the narrative hook: {narrative_hook}. "
        f"Target {word_min}-{word_max} Hebrew words. "
        f"The result should feel like a fun, friendly, and engaging podcast episode hosted by {narrator_name}. "
        "Ensure it is lively, entertaining, and connects naturally to the narrator's personality and previous life context. "
        "Do not repeat any stories or anecdotes from earlier episodes."
    )

    for attempt in range(2):
        response = create_script_completion(
            client,
            model=model,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
        )

        result = json.loads(response.choices[0].message.content.strip())
        hebrew = result.get("hebrew_paragraphs", [])
        english = result.get("english_paragraphs", [])

        if len(hebrew) != len(english):
            min_len = min(len(hebrew), len(english))
            hebrew = hebrew[:min_len]
            english = english[:min_len]

        word_count = count_hebrew_words(hebrew)
        if word_count >= word_min or attempt == 1:
            if word_count < word_min:
                print(
                    f"  Warning: script has {word_count} words (target {word_min}+). "
                    "Audio may be shorter than 10 minutes."
                )
            break

        print(f"  Script too short ({word_count} words). Regenerating with stricter length...")
        user_prompt = (
            f"Rewrite episode {episode_cfg['episode_number']} about: {episode_cfg['topic']}. "
            f"The previous draft was only {word_count} words. You MUST write {word_min}-{word_max} Hebrew words. "
            "Keep the same natural story feeling, include the useful phrases, and add more everyday scenes and examples."
        )

    return {
        "title": result.get("title", episode_cfg.get("title_en", f"Episode {episode_cfg['episode_number']}")),
        "script_model": model,
        "hebrew_paragraphs": hebrew,
        "english_paragraphs": english,
        "hebrew_text": "\n\n".join(hebrew),
        "translations": {"en": english},
    }


def enrich_script_translations(client: OpenAI, script: dict) -> dict:
    """Add ru/uk/pt/es/fr paragraph translations to a generated script."""
    hebrew = script.get("hebrew_paragraphs", [])
    english = script.get("english_paragraphs", [])
    if script.get("translations") and all(
        lang in script["translations"] for lang in ("ru", "uk", "pt", "es", "fr")
    ):
        return script

    print("  Generating ru, uk, pt, es, fr translations (gpt-5.4-mini)…")
    translations = build_translations_map(
        client,
        hebrew,
        english,
        langs=("ru", "uk", "pt", "es", "fr"),
        on_lang=lambda lang: print(f"    → {lang}"),
    )
    script["translations"] = translations
    return script


def is_tts_usage_guideline_error(detail: str) -> bool:
    lowered = detail.lower()
    return (
        "usage guidelines" in lowered
        or "support codes:" in lowered
        or "violates vertex ai" in lowered
    )


def is_retryable_tts_invalid_argument(detail: str) -> bool:
    lowered = detail.lower()
    return "invalid argument" in lowered or "400 request contains an invalid argument" in lowered


def sanitize_tts_text(text: str) -> str:
    """Remove punctuation that can trigger TTS false positives without changing meaning."""
    replacements = {
        "“": '"',
        "”": '"',
        "״": '"',
        "׳": "'",
        "’": "'",
        "–": "-",
        "—": "-",
        "…": "...",
    }
    sanitized = text
    for old, new in replacements.items():
        sanitized = sanitized.replace(old, new)

    # Dialogue quotes sometimes make the safety classifier overreact. The text
    # remains natural when read without literal quote marks.
    sanitized = sanitized.replace('"', "").replace("'", "")
    return " ".join(sanitized.split())


def simplify_tts_text(text: str) -> str:
    """Last-resort TTS fallback for harmless punctuation that Gemini rejects."""
    simplified = sanitize_tts_text(text)
    for char in [",", "?", "!", ":", ";", "־", "(", ")", "[", "]"]:
        simplified = simplified.replace(char, " ")
    return " ".join(simplified.split()).rstrip(".") + "."


def synthesize_paragraph(text: str, tts_cfg: dict) -> AudioSegment:
    """Synthesize one sentence/paragraph using Gemini 3.1 Flash TTS."""
    from google.api_core import exceptions as gcp_exceptions
    from google.cloud import texttospeech

    project_id, client_email = ensure_gcp_env()
    client = texttospeech.TextToSpeechClient()

    model_name = tts_cfg.get("model_name", DEFAULT_TTS_MODEL)
    voice = texttospeech.VoiceSelectionParams(
        language_code=tts_cfg.get("language_code", "he-IL"),
        name=tts_cfg.get("voice_name", "Achernar"),
        model_name=model_name,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        speaking_rate=tts_cfg.get("speaking_rate", 0.95),
        pitch=tts_cfg.get("pitch", 0),
    )

    default_prompt = tts_cfg.get("prompt", "Read aloud in a warm, welcoming tone.")
    neutral_prompt = "Read the Hebrew text aloud clearly and naturally."
    attempts = [
        (text, default_prompt, "default prompt"),
        (text, neutral_prompt, "neutral prompt"),
        (text, None, "no prompt"),
        (sanitize_tts_text(text), neutral_prompt, "sanitized text"),
        (simplify_tts_text(text), None, "simplified punctuation"),
    ]

    last_error: Exception | None = None
    last_detail = ""

    for attempt_text, prompt, label in attempts:
        input_args = {"text": attempt_text}
        if prompt:
            input_args["prompt"] = prompt
        synthesis_input = texttospeech.SynthesisInput(**input_args)

        try:
            response = client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
            )
            if label != "default prompt":
                print(f"    TTS retry succeeded with {label}.")
            return AudioSegment.from_file(io.BytesIO(response.audio_content), format="wav")
        except gcp_exceptions.PermissionDenied as exc:
            raise RuntimeError(
                format_tts_permission_error(project_id, client_email, str(exc))
            ) from exc
        except gcp_exceptions.GoogleAPICallError as exc:
            detail = str(exc)
            last_error = exc
            last_detail = detail
            if "aiplatform.endpoints.predict" in detail:
                raise RuntimeError(
                    format_tts_permission_error(project_id, client_email, detail)
                ) from exc
            if is_tts_usage_guideline_error(detail) or is_retryable_tts_invalid_argument(detail):
                print(f"    TTS retry after {label} failed: {detail}")
                continue
            raise RuntimeError(f"TTS failed: {detail}") from exc

    raise RuntimeError(
        "TTS failed after safety retries.\n"
        f"Text: {text}\n"
        f"Sanitized text: {sanitize_tts_text(text)}\n"
        f"Simplified text: {simplify_tts_text(text)}\n"
        f"Raw error: {last_detail}"
    ) from last_error


def synthesize_episode(
    hebrew_paragraphs: list[str],
    tts_cfg: dict,
    out_path: Path,
) -> tuple[float, list[dict]]:
    """Synthesize sentence-by-sentence and record exact timings.

    Whisper alignment is useful for external audio, but for generated episodes
    we control the audio assembly. Timing each synthesized sentence as
    we concatenate it produces much tighter UI sync than post-hoc alignment.
    """
    combined = AudioSegment.empty()
    timed_paragraphs: list[dict] = []
    sentence_gap_ms = int(tts_cfg.get("sentence_gap_ms", 180))
    paragraph_gap_ms = int(tts_cfg.get("paragraph_gap_ms", 550))

    for i, para in enumerate(hebrew_paragraphs):
        sentences = split_hebrew_sentences(para) or [para]
        paragraph_start_ms = len(combined)
        sentence_timings: list[dict] = []

        print(
            f"  TTS paragraph {i + 1}/{len(hebrew_paragraphs)} "
            f"({len(sentences)} sentence{'s' if len(sentences) != 1 else ''})..."
        )

        for j, sentence in enumerate(sentences):
            sentence_start_ms = len(combined)
            try:
                segment = synthesize_paragraph(sentence, tts_cfg)
            except RuntimeError as exc:
                raise RuntimeError(
                    "TTS failed for sentence "
                    f"{j + 1}/{len(sentences)} in paragraph {i + 1}/{len(hebrew_paragraphs)}.\n"
                    f"Sentence: {sentence}\n"
                    f"{exc}"
                ) from exc
            combined += segment
            sentence_end_ms = len(combined)

            sentence_timings.append(
                {
                    "text": sentence,
                    "start": round(sentence_start_ms / 1000, 2),
                    "end": round(sentence_end_ms / 1000, 2),
                }
            )

            if j < len(sentences) - 1 and sentence_gap_ms > 0:
                combined += AudioSegment.silent(duration=sentence_gap_ms)

        paragraph_end_ms = len(combined)
        timed_paragraphs.append(
            {
                "text": para,
                "start": round(paragraph_start_ms / 1000, 2),
                "end": round(paragraph_end_ms / 1000, 2),
                "sentences": sentence_timings,
            }
        )

        if paragraph_gap_ms > 0:
            combined += AudioSegment.silent(duration=paragraph_gap_ms)

    combined.export(out_path, format="mp3", bitrate="128k")
    duration_sec = len(combined) / 1000.0
    print(f"  Audio duration: {duration_sec / 60:.1f} min ({duration_sec:.0f}s)")
    return duration_sec, timed_paragraphs


def upload_audio(level: str, episode_number: int, audio_path: Path) -> str:
    storage_path = f"{level}/{episode_number:02d}.mp3"
    with audio_path.open("rb") as f:
        res = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/{AUDIO_BUCKET}/{storage_path}",
            headers={
                **service_headers({"Content-Type": "audio/mpeg", "x-upsert": "true"}),
            },
            data=f.read(),
            timeout=120,
        )
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Storage upload failed: {res.status_code} {res.text}")

    return f"{SUPABASE_URL}/storage/v1/object/public/{AUDIO_BUCKET}/{storage_path}"

def upsert_episode(level: str, episode_number: int, payload: dict) -> None:
    row = {
        "level_slug": level,
        "episode_number": episode_number,
        "title": payload["title"],
        "url": payload.get("url", ""),
        "audio_url": payload["audio_url"],
        "hebrew_text": payload["hebrew_text"],
        "hebrew_paragraphs": payload["hebrew_paragraphs"],
        "english_paragraphs": payload["english_paragraphs"],
        "translations": payload.get("translations", {"en": payload["english_paragraphs"]}),
        "is_published": True,
    }
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/episodes?on_conflict=level_slug,episode_number",
        headers=service_headers(
            {"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}
        ),
        json=row,
        timeout=60,
    )
    if res.status_code not in (200, 201):
        raise RuntimeError(f"DB upsert failed: {res.status_code} {res.text}")


def ensure_level(level: str, display: dict | None = None) -> None:
    slug = level
    display = display or {}
    name = display.get("name") or level.capitalize()
    cefr = display.get("cefr") or ("A1" if slug == "beginner" else "B1")
    sort_order = display.get("sort_order")
    if sort_order is None:
        sort_order = 0 if slug == "beginner" else 1
    res = requests.post(
        f"{SUPABASE_URL}/rest/v1/levels?on_conflict=slug",
        headers=service_headers({"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"}),
        json={"slug": slug, "name": name, "cefr": cefr, "sort_order": sort_order},
        timeout=30,
    )
    if res.status_code not in (200, 201):
        raise RuntimeError(f"Level upsert failed: {res.status_code} {res.text}")


def process_episode(
    curriculum: dict,
    episode_cfg: dict,
    *,
    force: bool,
    openai_client: OpenAI | None,
    script_bank: dict,
    script_bank_path: Path,
    scripts_only: bool,
    audio_only: bool,
    script_model: str | None,
) -> None:
    level = curriculum.get("level", "beginner")
    num = int(episode_cfg["episode_number"])

    if not scripts_only and not audio_only and episode_exists(level, num) and not force:
        print(f"Episode {level}/{num} already exists — skipping (use --force to regenerate)")
        return

    print(f"\n=== Generating {level} episode {num}: {episode_cfg.get('title_en', episode_cfg['topic'])} ===")
    checkpoint = load_checkpoint(level, num)

    bank_script = get_script_from_bank(script_bank, num)

    if bank_script and (not force or audio_only):
        script = bank_script
        if openai_client is not None:
            script = enrich_script_translations(openai_client, script)
        checkpoint["script"] = script
        save_checkpoint(level, num, checkpoint)
        print(f"Using stored script from {script_bank_path}")
    elif "script" in checkpoint and not force:
        script = checkpoint["script"]
        if openai_client is not None:
            script = enrich_script_translations(openai_client, script)
        upsert_script_in_bank(
            script_bank,
            level=level,
            episode_cfg=episode_cfg,
            script=script,
        )
        save_script_bank(script_bank_path, script_bank)
        print("Using cached script from checkpoint and syncing it to script bank")
    elif audio_only:
        raise SystemExit(
            f"Missing pre-generated script for {level} episode {num}. "
            f"Run: python3 pipeline/generate_episodes.py --level {level} --episode {num} --scripts-only"
        )
    else:
        if openai_client is None:
            raise SystemExit("Missing OPENAI_API_KEY; required for script generation.")
        model_name = script_model or curriculum.get("generation", {}).get("openai_model", "gpt-4.1")
        print(f"Generating script with {model_name}...")
        narrator_name = curriculum.get("narrator", {}).get("name", "Narrator")
        previous_context = build_previous_episode_context(script_bank, num, narrator_name=narrator_name)
        script = generate_script(
            openai_client,
            curriculum,
            episode_cfg,
            previous_context,
            script_model=script_model,
        )
        script = enrich_script_translations(openai_client, script)
        checkpoint["script"] = script
        save_checkpoint(level, num, checkpoint)
        upsert_script_in_bank(
            script_bank,
            level=level,
            episode_cfg=episode_cfg,
            script=script,
        )
        save_script_bank(script_bank_path, script_bank)
        print(f"Stored script in {script_bank_path}")

    if scripts_only:
        print(f"Script ready: {level} episode {num}")
        return

    hebrew_paragraphs = script["hebrew_paragraphs"]
    cached_audio = checkpoint_audio_path(level, num)

    if cached_audio.exists() and not force and "aligned_paragraphs" in checkpoint:
        audio_path = cached_audio
        print(f"Using cached audio from {cached_audio}")
        aligned = checkpoint["aligned_paragraphs"]
    else:
        audio_path = cached_audio
        print("Synthesizing audio with direct sentence timing...")
        duration_sec, aligned = synthesize_episode(hebrew_paragraphs, curriculum["tts"], audio_path)
        checkpoint["audio_ready"] = True
        checkpoint["audio_duration_sec"] = round(duration_sec, 2)
        checkpoint["aligned_paragraphs"] = aligned
        checkpoint["alignment_method"] = "direct_sentence_tts"
        save_checkpoint(level, num, checkpoint)
        print(f"Saved audio checkpoint: {cached_audio}")

    print("Uploading audio to Supabase Storage...")
    audio_url = upload_audio(level, num, audio_path)

    payload = {
        "title": script["title"],
        "url": "",
        "audio_url": audio_url,
        "hebrew_text": script["hebrew_text"],
        "hebrew_paragraphs": aligned,
        "english_paragraphs": script["english_paragraphs"],
        "translations": script.get("translations", {"en": script["english_paragraphs"]}),
    }

    print("Upserting episode row...")
    upsert_episode(level, num, payload)

    print(f"Done: {level} episode {num}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate level episodes via AI pipeline")
    parser.add_argument(
        "--list-levels",
        action="store_true",
        help="Print available curriculum level slugs and exit.",
    )
    parser.add_argument("--level", default="beginner")
    parser.add_argument("--episode", type=int, help="Generate a single episode number")
    parser.add_argument(
        "--from-episode",
        type=int,
        help="Generate all matching episodes from this episode number onward.",
    )
    parser.add_argument("--force", action="store_true", help="Regenerate even if exists")
    parser.add_argument(
        "--script-model",
        help=(
            "Override the OpenAI model used for script generation only. "
            "Does not affect Gemini TTS/audio generation."
        ),
    )
    parser.add_argument(
        "--scripts-only",
        action="store_true",
        help="Generate/store Hebrew+English scripts only; skip TTS, upload, and DB upsert.",
    )
    parser.add_argument(
        "--audio-only",
        action="store_true",
        help="Use pre-generated scripts from the script bank; skip script generation.",
    )
    parser.add_argument(
        "--script-bank",
        help="Path to persistent generated script JSON (default: pipeline/data/scripts/{level}.json).",
    )
    parser.add_argument(
        "--curriculum",
        help="Optional override path to curriculum JSON (default: pipeline/curriculum/{level}.json).",
    )
    args = parser.parse_args()

    if args.list_levels:
        levels = list_curriculum_levels()
        if not levels:
            print("No curriculum files found in pipeline/curriculum/")
        else:
            print("Available levels:")
            for level in levels:
                print(f"  - {level}")
        return

    if args.scripts_only and args.audio_only:
        raise SystemExit("--scripts-only and --audio-only cannot be used together.")

    if args.episode and args.from_episode:
        raise SystemExit("--episode and --from-episode cannot be used together.")

    if not args.audio_only and not OPENAI_API_KEY:
        raise SystemExit("Missing OPENAI_API_KEY")

    curriculum_path = resolve_curriculum_path(args.level, args.curriculum)
    if not curriculum_path.exists():
        raise SystemExit(
            f"Curriculum not found: {curriculum_path}\n"
            f"Create pipeline/curriculum/{args.level}.json or pass --curriculum PATH."
        )
    curriculum = load_curriculum(curriculum_path)
    curriculum_level = curriculum.get("level")
    if curriculum_level and args.level != curriculum_level:
        raise SystemExit(
            f"--level {args.level!r} does not match curriculum level {curriculum_level!r}. "
            "Use the exact curriculum level to avoid creating accidental level tabs."
        )
    curriculum["level"] = args.level

    if not args.scripts_only:
        ensure_level(args.level, curriculum.get("display"))

    openai_client = None if args.audio_only else OpenAI(api_key=OPENAI_API_KEY)
    script_bank_path = Path(args.script_bank) if args.script_bank else default_script_bank_path(args.level)
    if not script_bank_path.is_absolute():
        script_bank_path = (_PIPELINE_DIR / script_bank_path).resolve()
    script_bank = load_script_bank(script_bank_path)
    script_bank["level"] = args.level

    episodes = sorted(curriculum.get("episodes", []), key=lambda e: int(e["episode_number"]))

    if args.episode:
        episodes = [e for e in episodes if int(e["episode_number"]) == args.episode]
        if not episodes:
            raise SystemExit(f"Episode {args.episode} not found in curriculum")
    elif args.from_episode:
        episodes = [e for e in episodes if int(e["episode_number"]) >= args.from_episode]
        if not episodes:
            raise SystemExit(f"No episodes found from episode {args.from_episode} onward")

    for episode_cfg in episodes:
        process_episode(
            curriculum,
            episode_cfg,
            force=args.force,
            openai_client=openai_client,
            script_bank=script_bank,
            script_bank_path=script_bank_path,
            scripts_only=args.scripts_only,
            audio_only=args.audio_only,
            script_model=args.script_model,
        )

    if args.scripts_only:
        print(f"\nAll requested scripts complete: {script_bank_path}")
    else:
        print("\nAll requested episodes complete.")


if __name__ == "__main__":
    main()
