#Algorithms for routes close to cameras

from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt


EARTH_RADIUS_KM = 6371.0088


@dataclass(frozen=True)
class CameraPoint:
    camera_id: str
    latitude: float
    longitude: float


def haversine_km(a: CameraPoint, b: CameraPoint) -> float:
    lat1 = radians(a.latitude)
    lon1 = radians(a.longitude)
    lat2 = radians(b.latitude)
    lon2 = radians(b.longitude)
    dlat = lat2 - lat1
    dlon = lon2 - lon1

    h = sin(dlat / 2.0) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2.0) ** 2
    return 2.0 * EARTH_RADIUS_KM * asin(sqrt(h))


def path_distance_km(path: list[CameraPoint], closed_loop: bool = False) -> float:
    if len(path) <= 1:
        return 0.0

    total = 0.0
    for i in range(len(path) - 1):
        total += haversine_km(path[i], path[i + 1])

    if closed_loop:
        total += haversine_km(path[-1], path[0])
    return total


def nearest_neighbor_path(
    points: list[CameraPoint], start_index: int = 0
) -> list[CameraPoint]:
    if not points:
        return []
    if start_index < 0 or start_index >= len(points):
        raise ValueError("start_index out of range")

    remaining = points.copy()
    path = [remaining.pop(start_index)]

    while remaining:
        current = path[-1]
        next_idx = min(
            range(len(remaining)), key=lambda i: haversine_km(current, remaining[i])
        )
        path.append(remaining.pop(next_idx))
    return path


def two_opt(path: list[CameraPoint], closed_loop: bool = False) -> list[CameraPoint]:
    if len(path) < 4:
        return path

    best = path.copy()
    best_distance = path_distance_km(best, closed_loop=closed_loop)
    improved = True

    while improved:
        improved = False
        for i in range(1, len(best) - 2):
            for k in range(i + 1, len(best) - 1):
                candidate = best[:i] + best[i : k + 1][::-1] + best[k + 1 :]
                candidate_distance = path_distance_km(candidate, closed_loop=closed_loop)
                if candidate_distance + 1e-9 < best_distance:
                    best = candidate
                    best_distance = candidate_distance
                    improved = True
        # Keep runtime bounded for larger lists without adding extra complexity.
        if len(best) > 80:
            break

    return best


def optimize_camera_route(
    points: list[CameraPoint],
    start_camera_id: str | None = None,
    closed_loop: bool = False,
) -> tuple[list[CameraPoint], float]:
    if len(points) <= 1:
        return points.copy(), 0.0

    if start_camera_id is not None:
        starts = [idx for idx, p in enumerate(points) if p.camera_id == start_camera_id]
        if not starts:
            raise ValueError(f"start_camera_id '{start_camera_id}' not found")
        start_index = starts[0]
    else:
        start_index = 0

    seed = nearest_neighbor_path(points, start_index=start_index)
    best = two_opt(seed, closed_loop=closed_loop)
    return best, path_distance_km(best, closed_loop=closed_loop)
