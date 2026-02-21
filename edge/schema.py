"""WebSocket message schema — encoding helpers for edge-to-backend messages."""

import base64
from datetime import datetime, timezone

import cv2


def frame_to_base64(frame, quality=50):
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buf).decode("ascii")


def build_detection_message(frame, people_data, max_threat, threat_level,
                            threat_reasons, clip_event=None, mode="heuristic"):
    people = []
    for p in people_data:
        people.append({
            "person_id": p["person_id"],
            "bbox": p["bbox"],
            "is_horizontal": p.get("is_horizontal", False),
            "arm_velocity": p.get("arm_velocity", 0.0),
            "body_velocity": p.get("body_velocity", 0.0),
        })

    return {
        "type": "detection",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "frame_b64": frame_to_base64(frame),
        "people": people,
        "threat_score": float(max_threat),
        "threat_level": threat_level,
        "threat_reasons": list(threat_reasons),
        "clip_event": clip_event,
        "mode": mode,
    }


def build_heartbeat_message():
    return {
        "type": "heartbeat",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
