from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.schemas import AlertFeedbackIn, AlertOut
from app.ws import ws_manager

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(limit: int = 100, db: Session = Depends(get_db)) -> list[AlertOut]:
    return crud.list_alerts(db, limit=limit)


@router.patch("/{alert_id}/feedback", response_model=AlertOut)
async def set_alert_feedback(
    alert_id: int, payload: AlertFeedbackIn, db: Session = Depends(get_db)
) -> AlertOut:
    alert = crud.update_alert_status(db=db, alert_id=alert_id, status=payload.status)
    if alert is None:
        raise HTTPException(status_code=404, detail="alert not found")

    await ws_manager.broadcast_json(
        {
            "type": "alert.triaged",
            "version": 1,
            "payload": {
                "alert_id": alert.id,
                "incident_id": alert.incident_id,
                "status": alert.status,
            },
        }
    )
    return alert
