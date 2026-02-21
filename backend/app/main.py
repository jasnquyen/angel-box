from datetime import datetime, timezone
import os

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.db import engine, get_db
from app.routes import alerts, incidents
from app.schemas import DetectionIn
from app.services.processor import process_detection
from app.ws import ws_manager

app = FastAPI(title="Angel Box", version="0.1.0")

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
    models.Base.metadata.create_all(bind=engine)


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
                    "timestamp": alert.timestamp.isoformat(),
                    "threat_level": alert.threat_level,
                    "label": alert.label,
                    "confidence": alert.confidence,
                    "threat_score": alert.threat_score,
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
