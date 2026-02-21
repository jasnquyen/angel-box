from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud
from app.db import get_db
from app.schemas import IncidentOut

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentOut])
def list_incidents(limit: int = 100, db: Session = Depends(get_db)) -> list[IncidentOut]:
    return crud.list_incidents(db, limit=limit)
