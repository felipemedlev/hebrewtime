#!/usr/bin/env python3
"""Verify GCP credentials and Gemini 3.1 Flash TTS permissions before running the full pipeline."""

from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(PIPELINE_DIR))

from dotenv import load_dotenv

from lib.paths import ENV_PATH  # noqa: E402

load_dotenv(ENV_PATH)

from generate_episodes import (  # noqa: E402
    ensure_gcp_env,
    format_tts_permission_error,
    load_service_account_info,
    resolve_credentials_path,
)


def main() -> None:
    path = resolve_credentials_path()
    if not path:
        raise SystemExit("No credentials file found. Set GOOGLE_APPLICATION_CREDENTIALS in .env")

    info = load_service_account_info()
    project_id, client_email = ensure_gcp_env()

    print("GCP TTS verification")
    print(f"  Credentials file: {path}")
    print(f"  Project ID:       {project_id}")
    print(f"  Service account:  {client_email}")
    print(f"  Model:            gemini-3.1-flash-tts-preview")
    print()

    from google.api_core import exceptions as gcp_exceptions
    from google.cloud import texttospeech

    client = texttospeech.TextToSpeechClient()
    request = texttospeech.SynthesizeSpeechRequest(
        input=texttospeech.SynthesisInput(
            text="שלום.",
            prompt="Read aloud in a warm, welcoming tone.",
        ),
        voice=texttospeech.VoiceSelectionParams(
            language_code="he-IL",
            name="Achernar",
            model_name="gemini-3.1-flash-tts-preview",
        ),
        audio_config=texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        ),
    )

    try:
        response = client.synthesize_speech(request=request)
        print(f"OK — received {len(response.audio_content)} bytes of audio.")
        print("You can run: python3 pipeline/generate_episodes.py --level beginner --episode 1")
    except gcp_exceptions.PermissionDenied as exc:
        print(format_tts_permission_error(project_id, client_email, str(exc)))
        raise SystemExit(1) from exc
    except Exception as exc:
        detail = str(exc)
        if "aiplatform.endpoints.predict" in detail:
            print(format_tts_permission_error(project_id, client_email, detail))
            raise SystemExit(1) from exc
        raise


if __name__ == "__main__":
    main()
