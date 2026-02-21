from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.schemas import AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(limit: int = 100, db: Session = Depends(get_db)) -> list[AlertOut]:
    return crud.list_alerts(db, limit=limit)
