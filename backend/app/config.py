# Centralized runtime configuration loaded from environment variables.
# Keep thresholds, feature flags, and URLs here (not hardcoded in handlers).

from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "dev")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    database_url: str = os.getenv("DATABASE_URL", "")
    cors_origins: list[str] = tuple(
        x.strip() for x in os.getenv("CORS_ORIGINS", "").split(",") if x.strip()
    )

    alert_confidence_threshold: float = float(os.getenv("ALERT_CONFIDENCE_THRESHOLD", "0.8"))
    threat_score_threshold: float = float(os.getenv("THREAT_SCORE_THRESHOLD", "0.75"))
    incident_debounce_seconds: int = int(os.getenv("INCIDENT_DEBOUNCE_SECONDS", "10"))
    alert_cooldown_seconds: int = int(os.getenv("ALERT_COOLDOWN_SECONDS", "60"))
    max_frame_size_bytes: int = int(os.getenv("MAX_FRAME_SIZE_BYTES", "2000000"))

    save_frames: bool = _bool("SAVE_FRAMES", True)
    evidence_dir: str = os.getenv("EVIDENCE_DIR", "./data/evidence")
    save_clips: bool = _bool("SAVE_CLIPS", True)
    clips_dir: str = os.getenv("CLIPS_DIR", "./data/clips")
    max_clip_size_bytes: int = int(os.getenv("MAX_CLIP_SIZE_BYTES", "50000000"))

    enable_gemini: bool = _bool("ENABLE_GEMINI", False)
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")


settings = Settings()
