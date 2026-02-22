"""
Backend client for sending edge threat detections to the backend API.
Sends alerts in edge native format (timestamp, threat_score, level, reasons).
"""

import requests
import os
import time
from typing import Optional


class BackendClient:
    def __init__(
        self,
        backend_url: str = None,
        device_id: str = "edge_camera_01",
        latitude: float = 40.7128,
        longitude: float = -74.0060,
    ):
        """
        Initialize backend client.
        
        Args:
            backend_url: Backend API URL (default: http://localhost:8000)
            device_id: Device/camera identifier (sent as query param)
            latitude: Camera latitude (sent as query param, hardcoded)
            longitude: Camera longitude (sent as query param, hardcoded)
        """
        self.backend_url = backend_url or os.getenv("BACKEND_URL", "http://localhost:8000")
        self.device_id = device_id
        self.latitude = latitude
        self.longitude = longitude

    def send_alert(
        self,
        threat_score: float,
        level: str,
        reasons: list,
        timestamp: float = None,
        frame_number: int = None,
        frame_b64: str = None,
    ) -> dict:
        """
        Send a threat alert to the backend in edge native format.
        
        Args:
            threat_score: Threat score (0-1)
            level: Threat level (HIGH, MEDIUM, LOW, NONE)
            reasons: List of threat reasons
            timestamp: Unix timestamp (default: now)
            frame_number: Frame number for reference
            frame_b64: Base64 encoded frame image
            
        Returns:
            Response JSON from backend
        """
        if timestamp is None:
            timestamp = time.time()
        
        payload = {
            "timestamp": timestamp,
            "threat_score": min(1.0, max(0.0, threat_score)),
            "level": level,
            "reasons": reasons,
            "frame_number": frame_number,
            "frame_b64": frame_b64,
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/edge/alerts",
                json=payload,
                params={
                    "device_id": self.device_id,
                    "latitude": self.latitude,
                    "longitude": self.longitude,
                },
                timeout=5,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error sending alert to backend: {e}")
            return {"error": str(e)}


# Example usage in edge/main.py:
#
# from client import BackendClient
#
# client = BackendClient()
#
# # After threat detection...
# if max_threat >= 0.75:
#     result = client.send_alert(
#         threat_score=max_threat,
#         level="HIGH",
#         reasons=threat_reasons,
#         frame_number=scorer.frame_count,
#         frame_b64=frame_b64_encoded,  # optional
#     )
#     print(f"Alert sent: {result}")