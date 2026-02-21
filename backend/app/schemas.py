from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

AlertStatus = Literal["pending", "confirmed_threat", "false_alarm"]


class DetectionIn(BaseModel):  # Validated ingestion schema for incoming detection data
    device_id: str
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)
    timestamp: datetime
    label: str
    confidence: float = Field(ge=0.0, le=1.0)
    threat_score: float = Field(ge=0.0, le=1.0)
    frame_b64: str | None = None


class AlertOut(BaseModel):  # Schema for outgoing alert data sent to clients and stored in DB
    id: int
    incident_id: int
    timestamp: datetime
    threat_level: str
    label: str
    confidence: float
    threat_score: float
    frame_url: str | None = None
    gemini_narration: str | None = None
    status: AlertStatus

    class Config:
        from_attributes = True


class IncidentOut(BaseModel):  # Schema for incident data sent to clients and stored in DB
    id: int
    device_id: str
    latitude: float
    longitude: float
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


class AlertFeedbackIn(BaseModel):
    status: AlertStatus
