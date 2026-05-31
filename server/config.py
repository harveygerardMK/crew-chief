"""Server configuration from environment."""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone

UTC = timezone.utc
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Tahoe 200 start: June 12, 2026, 9:00 AM PDT (UTC-7)
RACE_START = datetime(2026, 6, 12, 16, 0, 0, tzinfo=UTC)

VALID_RELATIONSHIPS = frozenset({"family", "friend", "crew", "pacer", "stranger"})


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str | None
    claude_model: str
    claude_max_tokens: int
    voice_path: Path
    fallback_path: Path
    status_path: Path
    visitors_path: Path
    cors_origins: list[str]
    github_token: str | None
    github_owner: str
    github_repo: str
    github_branch: str
    visitors_export_path: str

    @property
    def race_started(self) -> bool:
        return datetime.now(UTC) >= RACE_START

    @property
    def claude_configured(self) -> bool:
        return _anthropic_key_valid(self.anthropic_api_key)


def _anthropic_key_valid(key: str | None) -> bool:
    """Reject empty keys and common paste typos (e.g. ssk-ant)."""
    if not key:
        return False
    trimmed = key.strip()
    if trimmed.startswith("ssk-"):
        return False
    return trimmed.startswith("sk-ant-") and len(trimmed) > 20


def load_settings() -> Settings:
    try:
        from dotenv import load_dotenv

        load_dotenv(REPO_ROOT / "server" / ".env")
    except ImportError:
        pass

    cors_raw = os.environ.get("CORS_ORIGINS", "*")
    origins = ["*"] if cors_raw.strip() == "*" else [o.strip() for o in cors_raw.split(",") if o.strip()]

    return Settings(
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY") or None,
        claude_model=os.environ.get("CLAUDE_MODEL", "claude-sonnet-4-20250514"),
        claude_max_tokens=int(os.environ.get("CLAUDE_MAX_TOKENS", "1000")),
        voice_path=Path(os.environ.get("VOICE_PATH", REPO_ROOT / "voice.md")),
        fallback_path=Path(os.environ.get("FALLBACK_PATH", REPO_ROOT / "server" / "fallback.md")),
        status_path=Path(os.environ.get("HARVEY_STATUS_PATH", REPO_ROOT / "data" / "harvey_status.json")),
        visitors_path=Path(os.environ.get("VISITORS_PATH", REPO_ROOT / "data" / "visitors.json")),
        cors_origins=origins,
        github_token=os.environ.get("GITHUB_TOKEN") or None,
        github_owner=os.environ.get("GITHUB_OWNER", "harveygerardMK"),
        github_repo=os.environ.get("GITHUB_REPO", "crew-chief"),
        github_branch=os.environ.get("GITHUB_BRANCH", "main"),
        visitors_export_path=os.environ.get("VISITORS_EXPORT_PATH", "data/visitors.json"),
    )
