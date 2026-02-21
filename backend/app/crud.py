from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app import models
from app.schemas import DetectionIn


def create_detection_event(
    db: Session, payload: DetectionIn, frame_url: str | None
) -> models.DetectionEvent:
    event = models.DetectionEvent(
        device_id=payload.device_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        timestamp=payload.timestamp,
        label=payload.label,
        confidence=payload.confidence,
        threat_score=payload.threat_score,
        frame_url=frame_url,
    )
    db.add(event)
    db.flush()
    return event


def find_recent_open_incident(
    db: Session, device_id: str, label: str, debounce_seconds: int
) -> models.Incident | None:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=debounce_seconds)
    stmt = (
        select(models.Incident)
        .where(
            models.Incident.device_id == device_id,
            models.Incident.label == label,
            models.Incident.status == "open",
            models.Incident.last_seen >= cutoff,
        )
        .order_by(desc(models.Incident.last_seen))
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def create_incident(
    db: Session, payload: DetectionIn, frame_url: str | None
) -> models.Incident:
    incident = models.Incident(
        device_id=payload.device_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        label=payload.label,
        status="open",
        first_seen=payload.timestamp,
        last_seen=payload.timestamp,
        event_count=1,
        max_confidence=payload.confidence,
        max_threat_score=payload.threat_score,
        last_frame_url=frame_url,
    )
    db.add(incident)
    db.flush()
    return incident


def update_incident(
    incident: models.Incident, payload: DetectionIn, frame_url: str | None
) -> models.Incident:
    incident.last_seen = payload.timestamp
    incident.latitude = payload.latitude
    incident.longitude = payload.longitude
    incident.event_count += 1
    incident.max_confidence = max(incident.max_confidence, payload.confidence)
    incident.max_threat_score = max(incident.max_threat_score, payload.threat_score)
    if frame_url:
        incident.last_frame_url = frame_url
    return incident


def create_alert(
    db: Session,
    incident_id: int,
    payload: DetectionIn,
    frame_url: str | None,
    threat_level: str,
    gemini_narration: str | None = None,
) -> models.Alert:
    alert = models.Alert(
        incident_id=incident_id,
        threat_level=threat_level,
        label=payload.label,
        confidence=payload.confidence,
        threat_score=payload.threat_score,
        frame_url=frame_url,
        gemini_narration=gemini_narration,
        status="new",
    )
    db.add(alert)
    db.flush()
    return alert


def list_alerts(db: Session, limit: int = 100) -> list[models.Alert]:
    stmt = select(models.Alert).order_by(desc(models.Alert.timestamp)).limit(limit)
    return list(db.execute(stmt).scalars().all())


def list_incidents(db: Session, limit: int = 100) -> list[models.Incident]:
    stmt = select(models.Incident).order_by(desc(models.Incident.last_seen)).limit(limit)
    return list(db.execute(stmt).scalars().all())
