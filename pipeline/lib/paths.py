"""Shared path constants for the HebrewTime content pipeline."""

from __future__ import annotations

from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = PIPELINE_DIR.parent
ENV_PATH = REPO_ROOT / ".env"
SECRETS_DIR = REPO_ROOT / "secrets"
CURRICULUM_DIR = PIPELINE_DIR / "curriculum"
DATA_DIR = PIPELINE_DIR / "data"
SCRIPT_BANK_DIR = DATA_DIR / "scripts"
LEGACY_EPISODES_PATH = DATA_DIR / "episodes.json"
LEGACY_EPISODES_CHECKPOINT_PATH = DATA_DIR / "episodes_checkpoint.json"
CHECKPOINT_DIR = PIPELINE_DIR / ".checkpoints"

DEFAULT_CREDENTIALS_CANDIDATES = [
    SECRETS_DIR / "gcp-service-account.json",
    SECRETS_DIR / "google-tts.json",
    REPO_ROOT / "gcp-service-account.json",
]


def resolve_curriculum_path(level: str, override: str | None = None) -> Path:
    if override:
        path = Path(override)
        return path if path.is_absolute() else (PIPELINE_DIR / path).resolve()
    return CURRICULUM_DIR / f"{level}.json"


def default_script_bank_path(level: str) -> Path:
    SCRIPT_BANK_DIR.mkdir(parents=True, exist_ok=True)
    return SCRIPT_BANK_DIR / f"{level}.json"


def list_curriculum_levels() -> list[str]:
    if not CURRICULUM_DIR.exists():
        return []
    return sorted(path.stem for path in CURRICULUM_DIR.glob("*.json"))
