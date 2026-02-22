# Route Optimization APIs

This service provides a simple camera-path optimizer for latitude/longitude points.

## Algorithm

- Seed path with nearest-neighbor.
- Improve path with 2-opt swaps.
- Distance metric uses Haversine (great-circle distance).

This is a fast, easy baseline for dummy or hypothetical camera coordinates.

## Run

```powershell
cd shiv_backend/route-optimization-apis
pip install -r requirements.txt
uvicorn app:app --reload --port 8010
```

## Endpoints

`POST /optimize/cameras`

Request:

```json
{
  "cameras": [
    {"camera_id": "cam-a", "latitude": 40.7128, "longitude": -74.0060},
    {"camera_id": "cam-b", "latitude": 40.7295, "longitude": -73.9965},
    {"camera_id": "cam-c", "latitude": 40.7061, "longitude": -74.0086}
  ],
  "start_camera_id": "cam-a",
  "closed_loop": false
}
```

Response:

```json
{
  "ordered_cameras": [
    {"camera_id": "cam-a", "latitude": 40.7128, "longitude": -74.006},
    {"camera_id": "cam-c", "latitude": 40.7061, "longitude": -74.0086},
    {"camera_id": "cam-b", "latitude": 40.7295, "longitude": -73.9965}
  ],
  "total_distance_km": 3.154,
  "total_distance_miles": 1.96
}
```

`POST /path/suggestions`

This endpoint is dashboard-friendly and can optionally enrich the camera path
with Google Routes API output (distance, duration, encoded polyline).

Request:

```json
{
  "cameras": [
    {"camera_id": "cam-a", "latitude": 40.7128, "longitude": -74.0060},
    {"camera_id": "cam-b", "latitude": 40.7295, "longitude": -73.9965},
    {"camera_id": "cam-c", "latitude": 40.7061, "longitude": -74.0086}
  ],
  "start_camera_id": "cam-a",
  "closed_loop": false,
  "travel_mode": "WALK",
  "use_google_routes": true
}
```

Response:

```json
{
  "ordered_cameras": [
    {"camera_id": "cam-a", "latitude": 40.7128, "longitude": -74.006},
    {"camera_id": "cam-c", "latitude": 40.7061, "longitude": -74.0086},
    {"camera_id": "cam-b", "latitude": 40.7295, "longitude": -73.9965}
  ],
  "local_total_distance_km": 3.154,
  "local_total_distance_miles": 1.96,
  "google_route": {
    "distance_meters": 3500,
    "duration": "950s",
    "polyline": "..."
  }
}
```

Google integration:

- Set `GOOGLE_ROUTES_API_KEY` in your environment.
- Optional overrides:
  - `ROUTES_MAX_WAYPOINTS` (default `25`)
  - `GOOGLE_ROUTES_BASE_URL` (default `https://routes.googleapis.com`)
  - `GOOGLE_ROUTES_TIMEOUT_SECONDS` (default `10`)
