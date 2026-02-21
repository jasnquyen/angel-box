from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DetectionEvent(Base):
    __tablename__ = "detection_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    device_id: Mapped[str] = mapped_column(String(128), index=True)
    trail_id: Mapped[str] = mapped_column(String(128), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    label: Mapped[str] = mapped_column(String(128), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    threat_score: Mapped[float] = mapped_column(Float)
    frame_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    trail_id: Mapped[str] = mapped_column(String(128), index=True)
    label: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    event_count: Mapped[int] = mapped_column(Integer, default=1)
    max_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    max_threat_score: Mapped[float] = mapped_column(Float, default=0.0)
    last_frame_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    alerts: Mapped[list["Alert"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    incident_id: Mapped[int] = mapped_column(ForeignKey("incidents.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    threat_level: Mapped[str] = mapped_column(String(16), index=True)
    label: Mapped[str] = mapped_column(String(128), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    threat_score: Mapped[float] = mapped_column(Float)
    frame_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    gemini_narration: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="new", index=True)

    incident: Mapped[Incident] = relationship(back_populates="alerts")
