import base64
import os
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app import crud, models
from app.config import settings
from app.schemas import DetectionIn, EdgeAlert


def _edge_alert_to_detection(
    edge_alert: EdgeAlert,
    device_id: str = "edge_camera_01",
    latitude: float = 40.7128,
    longitude: float = -74.0060,
) -> DetectionIn:
    """
    Convert EdgeAlert format to DetectionIn format.
    
    Args:
        edge_alert: Alert from edge device
        device_id: Device identifier (hardcoded default)
        latitude: Camera latitude (hardcoded)
        longitude: Camera longitude (hardcoded)
    
    Returns:
        DetectionIn payload compatible with backend processing
    """
    # Convert unix timestamp to datetime
    dt = datetime.fromtimestamp(edge_alert.timestamp, tz=timezone.utc)
    
    # Map threat level to label
    label = "violence_detection"  # Default label, could map level to specific labels
    
    return DetectionIn(
        device_id=device_id,
        latitude=latitude,
        longitude=longitude,
        timestamp=dt,
        label=label,
        confidence=edge_alert.threat_score,  # Use threat_score as confidence
        threat_score=edge_alert.threat_score,
        frame_b64=edge_alert.frame_b64,
    )


def _threat_level(score: float) -> str:
    if score >= 0.9:
        return "critical"
    if score >= 0.75:
        return "high"
    if score >= 0.5:
        return "medium"
    return "low"


def _save_frame(frame_b64: str) -> str:
    raw = base64.b64decode(frame_b64, validate=True)
    if len(raw) > settings.max_frame_size_bytes:
        raise ValueError("frame exceeds MAX_FRAME_SIZE_BYTES")
    os.makedirs(settings.evidence_dir, exist_ok=True)
    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{uuid4().hex}.jpg"
    path = os.path.join(settings.evidence_dir, filename)
    with open(path, "wb") as f:
        f.write(raw)
    return path


def _gemini_stub(payload: DetectionIn) -> str | None:
    if not settings.enable_gemini:
        return None
    return (
        f"Potential {payload.label} detected near "
        f"{payload.latitude:.5f}, {payload.longitude:.5f}. "
        f"Threat score {payload.threat_score:.2f}."
    )


def process_detection(
    db: Session, payload: DetectionIn
) -> tuple[models.Incident, models.Alert | None]:
    frame_url = None
    if settings.save_frames and payload.frame_b64:
        frame_url = _save_frame(payload.frame_b64)

    crud.create_detection_event(db, payload, frame_url=frame_url)

    incident = crud.find_recent_open_incident(
        db=db,
        device_id=payload.device_id,
        label=payload.label,
        debounce_seconds=settings.incident_debounce_seconds,
    )
    if incident is None:
        incident = crud.create_incident(db=db, payload=payload, frame_url=frame_url)
    else:
        incident = crud.update_incident(incident=incident, payload=payload, frame_url=frame_url)

    alert = None
    if (
        payload.confidence >= settings.alert_confidence_threshold
        and payload.threat_score >= settings.threat_score_threshold
    ):
        alert = crud.create_alert(
            db=db,
            incident_id=incident.id,
            payload=payload,
            frame_url=frame_url,
            threat_level=_threat_level(payload.threat_score),
            gemini_narration=_gemini_stub(payload),
        )

    db.commit()
    db.refresh(incident)
    if alert is not None:
        db.refresh(alert)
    return incident, alert
