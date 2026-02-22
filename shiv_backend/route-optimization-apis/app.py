#FastAPI endpoints 

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Literal

from google_routes import compute_google_route
from optimizer import CameraPoint, optimize_camera_route


class CameraInput(BaseModel):
    camera_id: str = Field(min_length=1)
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)


class RouteRequest(BaseModel):
    cameras: list[CameraInput] = Field(min_length=2)
    start_camera_id: str | None = None
    closed_loop: bool = False


TravelMode = Literal["WALK", "DRIVE", "BICYCLE", "TWO_WHEELER"]


class LatLngInput(BaseModel):
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)


class PathSuggestionRequest(BaseModel):
    cameras: list[CameraInput] = Field(min_length=2)
    start_camera_id: str | None = None
    closed_loop: bool = False
    travel_mode: TravelMode = "WALK"
    use_google_routes: bool = True
    origin: LatLngInput | None = None
    destination: LatLngInput | None = None


class RouteCamera(BaseModel):
    camera_id: str
    latitude: float
    longitude: float


class RouteResponse(BaseModel):
    ordered_cameras: list[RouteCamera]
    total_distance_km: float
    total_distance_miles: float


class GoogleRouteSummary(BaseModel):
    distance_meters: int | None = None
    duration: str | None = None
    polyline: str | None = None


class PathSuggestionResponse(BaseModel):
    ordered_cameras: list[RouteCamera]
    local_total_distance_km: float
    local_total_distance_miles: float
    google_route: GoogleRouteSummary | None = None


app = FastAPI(title="Shiv Route Optimization APIs", version="0.1.0")


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/optimize/cameras", response_model=RouteResponse)
def optimize_cameras(request: RouteRequest) -> RouteResponse:
    by_id: set[str] = set()
    for cam in request.cameras:
        if cam.camera_id in by_id:
            raise HTTPException(
                status_code=400, detail=f"Duplicate camera_id: {cam.camera_id}"
            )
        by_id.add(cam.camera_id)

    points = [
        CameraPoint(camera_id=c.camera_id, latitude=c.latitude, longitude=c.longitude)
        for c in request.cameras
    ]
    try:
        ordered, total_km = optimize_camera_route(
            points,
            start_camera_id=request.start_camera_id,
            closed_loop=request.closed_loop,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return RouteResponse(
        ordered_cameras=[
            RouteCamera(
                camera_id=p.camera_id, latitude=p.latitude, longitude=p.longitude
            )
            for p in ordered
        ],
        total_distance_km=round(total_km, 3),
        total_distance_miles=round(total_km * 0.621371, 3),
    )


@app.post("/path/suggestions", response_model=PathSuggestionResponse)
def path_suggestions(request: PathSuggestionRequest) -> PathSuggestionResponse:
    by_id: set[str] = set()
    for cam in request.cameras:
        if cam.camera_id in by_id:
            raise HTTPException(
                status_code=400, detail=f"Duplicate camera_id: {cam.camera_id}"
            )
        by_id.add(cam.camera_id)

    points = [
        CameraPoint(camera_id=c.camera_id, latitude=c.latitude, longitude=c.longitude)
        for c in request.cameras
    ]
    try:
        ordered, total_km = optimize_camera_route(
            points,
            start_camera_id=request.start_camera_id,
            closed_loop=request.closed_loop,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    google_route: GoogleRouteSummary | None = None
    if request.use_google_routes:
        origin = (
            (request.origin.latitude, request.origin.longitude)
            if request.origin is not None
            else (ordered[0].latitude, ordered[0].longitude)
        )
        destination = (
            (request.destination.latitude, request.destination.longitude)
            if request.destination is not None
            else (
                (ordered[0].latitude, ordered[0].longitude)
                if request.closed_loop
                else (ordered[-1].latitude, ordered[-1].longitude)
            )
        )

        if request.origin is not None or request.destination is not None:
            intermediates = [(p.latitude, p.longitude) for p in ordered]
        elif request.closed_loop:
            intermediates = [(p.latitude, p.longitude) for p in ordered[1:]]
        else:
            intermediates = [(p.latitude, p.longitude) for p in ordered[1:-1]]

        max_waypoints = int(os.getenv("ROUTES_MAX_WAYPOINTS", "25"))
        if len(intermediates) > max_waypoints:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Too many waypoints for route lookup: {len(intermediates)} "
                    f"(max {max_waypoints})"
                ),
            )

        try:
            route_data = compute_google_route(
                origin=origin,
                destination=destination,
                intermediates=intermediates,
                travel_mode=request.travel_mode,
            )
            google_route = GoogleRouteSummary(**route_data)
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Google route lookup failed: {exc}"
            ) from exc

    return PathSuggestionResponse(
        ordered_cameras=[
            RouteCamera(camera_id=p.camera_id, latitude=p.latitude, longitude=p.longitude)
            for p in ordered
        ],
        local_total_distance_km=round(total_km, 3),
        local_total_distance_miles=round(total_km * 0.621371, 3),
        google_route=google_route,
    )
