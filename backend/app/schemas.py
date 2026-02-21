from datetime import datetime

from pydantic import BaseModel, Field


class DetectionIn(BaseModel):
    device_id: str
    trail_id: str
    timestamp: datetime
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    threat_score: float = Field(ge=0.0, le=1.0)
    frame_b64: str | None = None


class AlertOut(BaseModel):
    id: int
    incident_id: int
    timestamp: datetime
    threat_level: str
    label: str
    confidence: float
    threat_score: float
    frame_url: str | None = None
    gemini_narration: str | None = None
    status: str

    class Config:
        from_attributes = True


class IncidentOut(BaseModel):
    id: int
    trail_id: str
    label: str
    status: str
    first_seen: datetime
    last_seen: datetime
    event_count: int
    max_confidence: float
    max_threat_score: float
    last_frame_url: str | None = None

    class Config:
        from_attributes = True
