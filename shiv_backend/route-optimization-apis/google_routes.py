from __future__ import annotations

import os
from typing import Literal

import requests

TravelMode = Literal["WALK", "DRIVE", "BICYCLE", "TWO_WHEELER"]


def _latlng(latitude: float, longitude: float) -> dict:
    return {"location": {"latLng": {"latitude": latitude, "longitude": longitude}}}


def compute_google_route(
    *,
    origin: tuple[float, float],
    destination: tuple[float, float],
    intermediates: list[tuple[float, float]],
    travel_mode: TravelMode,
) -> dict:
    api_key = os.getenv("GOOGLE_ROUTES_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GOOGLE_ROUTES_API_KEY is not configured")

    base_url = os.getenv("GOOGLE_ROUTES_BASE_URL", "https://routes.googleapis.com").rstrip(
        "/"
    )
    timeout_seconds = int(os.getenv("GOOGLE_ROUTES_TIMEOUT_SECONDS", "10"))

    url = f"{base_url}/directions/v2:computeRoutes"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
    }
    payload = {
        "origin": _latlng(origin[0], origin[1]),
        "destination": _latlng(destination[0], destination[1]),
        "intermediates": [_latlng(lat, lon) for lat, lon in intermediates],
        "travelMode": travel_mode,
    }

    response = requests.post(url, json=payload, headers=headers, timeout=timeout_seconds)
    response.raise_for_status()
    data = response.json()
    routes = data.get("routes", [])
    if not routes:
        raise ValueError("Google Routes API returned no routes")

    route = routes[0]
    return {
        "distance_meters": route.get("distanceMeters"),
        "duration": route.get("duration"),
        "polyline": route.get("polyline", {}).get("encodedPolyline"),
    }
