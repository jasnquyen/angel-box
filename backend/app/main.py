from datetime import datetime, timezone
import os
from pathlib import Path
from uuid import uuid4

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.db import engine, get_db
from app.routes import alerts, incidents
from app.schemas import DetectionIn, EdgeAlert
from app.services.processor import process_detection, _edge_alert_to_detection
from app.ws import ws_manager

app = FastAPI(title="Angel Box", version="0.1.0")
app.mount("/media/clips", StaticFiles(directory=settings.clips_dir, check_dir=False), name="clips")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins) or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(alerts.router)
app.include_router(incidents.router)


@app.on_event("startup")
def on_startup() -> None:
    if settings.save_frames:
        os.makedirs(settings.evidence_dir, exist_ok=True)
    if settings.save_clips:
        os.makedirs(settings.clips_dir, exist_ok=True)
    print("✓ Backend initialized successfully")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "env": settings.app_env}


@app.post("/detections")
async def ingest_detection(payload: DetectionIn, db: Session = Depends(get_db)) -> dict:
    try:
        incident, alert = process_detection(db=db, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if alert is not None:
        await ws_manager.broadcast_json(
            {
                "type": "alert.created",
                "version": 1,
                "payload": {
                    "alert_id": alert.id,
                    "incident_id": incident.id,
                    "device_id": incident.device_id,
                    "timestamp": alert.timestamp.isoformat(),
                    "threat_level": alert.threat_level,
                    "label": alert.label,
                    "confidence": alert.confidence,
                    "threat_score": alert.threat_score,
                    "latitude": incident.latitude,
                    "longitude": incident.longitude,
                    "frame_url": alert.frame_url,
                    "gemini_narration": alert.gemini_narration,
                },
            }
        )

    return {
        "accepted": True,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "incident_id": incident.id,
        "alert_created": alert is not None,
        "alert_id": alert.id if alert else None,
    }


@app.post("/edge/alerts")
async def ingest_edge_alert(
    payload: EdgeAlert,
    db: Session = Depends(get_db),
    device_id: str = "edge_camera_01",
    latitude: float = 40.7128,
    longitude: float = -74.0060,
) -> dict:
    """
    Ingest alerts from edge device.
    
    Query parameters:
    - device_id: Device identifier (default: edge_camera_01)
    - latitude: Camera latitude (default: 40.7128)
    - longitude: Camera longitude (default: -74.0060)
    """
    try:
        # Convert edge alert format to detection format
        detection = _edge_alert_to_detection(
            payload, device_id=device_id, latitude=latitude, longitude=longitude
        )
        incident, alert = process_detection(db=db, payload=detection)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if alert is not None:
        await ws_manager.broadcast_json(
            {
                "type": "alert.created",
                "version": 1,
                "payload": {
                    "alert_id": alert.id,
                    "incident_id": incident.id,
                    "device_id": incident.device_id,
                    "timestamp": alert.timestamp.isoformat(),
                    "threat_level": alert.threat_level,
                    "label": alert.label,
                    "confidence": alert.confidence,
                    "threat_score": alert.threat_score,
                    "latitude": incident.latitude,
                    "longitude": incident.longitude,
                    "frame_url": alert.frame_url,
                    "gemini_narration": alert.gemini_narration,
                },
            }
        )

    return {
        "accepted": True,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "incident_id": incident.id,
        "alert_created": alert is not None,
        "alert_id": alert.id if alert else None,
    }


def _clip_ext(content_type: str | None, filename: str | None) -> str:
    by_mime = {
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-matroska": ".mkv",
        "video/webm": ".webm",
        "video/x-msvideo": ".avi",
    }
    if content_type in by_mime:
        return by_mime[content_type]
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in {".mp4", ".mov", ".mkv", ".webm", ".avi"}:
            return ext
    return ".mp4"


@app.post("/clips/upload")
async def upload_clip(
    clip: UploadFile = File(...),
    device_id: str | None = Form(default=None),
    incident_id: int | None = Form(default=None),
) -> dict:
    if not settings.save_clips:
        raise HTTPException(status_code=400, detail="clip uploads are disabled")
    if clip.content_type and not clip.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="uploaded file must be a video")

    filename = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{uuid4().hex}{_clip_ext(clip.content_type, clip.filename)}"
    out_path = Path(settings.clips_dir) / filename

    total = 0
    chunk_size = 1024 * 1024
    try:
        with out_path.open("wb") as f:
            while True:
                chunk = await clip.read(chunk_size)
                if not chunk:
                    break
                total += len(chunk)
                if total > settings.max_clip_size_bytes:
                    raise HTTPException(status_code=413, detail="clip exceeds MAX_CLIP_SIZE_BYTES")
                f.write(chunk)
    finally:
        await clip.close()

    clip_url = f"/media/clips/{filename}"
    await ws_manager.broadcast_json(
        {
            "type": "clip.uploaded",
            "version": 1,
            "payload": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "device_id": device_id,
                "incident_id": incident_id,
                "clip_url": clip_url,
                "bytes": total,
            },
        }
    )

    return {
        "uploaded": True,
        "clip_url": clip_url,
        "bytes": total,
        "device_id": device_id,
        "incident_id": incident_id,
    }


@app.websocket("/ws/dashboard")
async def dashboard_ws(websocket: WebSocket) -> None:
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
