# Edge WebSocket Endpoints

Single persistent WebSocket connection between edge device and backend.

**Connection URL:** `ws://<backend-host>:8000/ws/edge`
**Env var:** `EDGE_WS_URL` (default: `ws://localhost:8000/ws/edge`)

---

## Edge -> Backend (outbound)

### `detection`
Sent every frame (~15 fps). Core telemetry message.

```json
{
  "type": "detection",
  "timestamp": "2026-02-21T12:00:00.000000+00:00",
  "frame_b64": "<base64 JPEG, quality=50>",
  "people": [
    {
      "person_id": 0,
      "bbox": [x1, y1, x2, y2],
      "is_horizontal": false,
      "arm_velocity": 12.5,
      "body_velocity": 3.2
    }
  ],
  "threat_score": 0.82,
  "threat_level": "HIGH",
  "threat_reasons": ["directed strike (dir:0.85 spd:0.62)", "[heuristic]"],
  "clip_event": null,
  "mode": "heuristic"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `frame_b64` | string | Base64-encoded JPEG of the current frame |
| `people` | array | One entry per detected person |
| `people[].person_id` | int | Tracker-assigned ID (stable across frames) |
| `people[].bbox` | int[4] | Bounding box `[x1, y1, x2, y2]` in pixels |
| `people[].is_horizontal` | bool | True if person is lying down |
| `people[].arm_velocity` | float | Wrist speed (pixels/frame) |
| `people[].body_velocity` | float | Body centroid speed (pixels/frame) |
| `threat_score` | float | 0.0 - 1.0, max across all pairs/solo |
| `threat_level` | string | `NONE` (<0.3), `LOW` (0.3-0.5), `MEDIUM` (0.5-0.75), `HIGH` (>=0.75) |
| `threat_reasons` | string[] | Human-readable reasons for current score |
| `clip_event` | object/null | Non-null when clip recording starts or completes |
| `mode` | string | `"heuristic"` or `"ml"` |

### `clip`
Sent when a threat clip finishes recording (30s pre-event + 10s post-event).

```json
{
  "type": "clip",
  "timestamp": "2026-02-21T12:00:40.000000+00:00",
  "clip_b64": "<base64 MP4>",
  "filename": "clip_20260221_120000.mp4"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `clip_b64` | string | Base64-encoded MP4 video file |
| `filename` | string | Original filename on edge device |

### `heartbeat`
Sent every 30 seconds. Proves the edge device is alive even when idle.

```json
{
  "type": "heartbeat",
  "timestamp": "2026-02-21T12:00:30.000000+00:00"
}
```

---

## Backend -> Edge (inbound)

### `feedback`
Label the most recent feature vector (online learning). Sent by a human reviewer.

```json
{
  "type": "feedback",
  "label": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `label` | int | `1` = threat, `0` = safe. Applied to `last_feature_vec` |

### `retrain`
Trigger the classifier to retrain on all accumulated samples.

```json
{
  "type": "retrain"
}
```

### `config`
Update edge-side configuration (placeholder -- logged but not yet acted on).

```json
{
  "type": "config",
  "threat_threshold": 0.75,
  "fps": 15
}
```

---

## Connection Behavior

- Edge is the **client**, backend is the **server**
- Auto-reconnect on disconnect (inside `EdgeStreamer.send`)
- `StreamerBridge` wraps the async client in a sync API for the OpenCV main loop
- All messages are JSON over a single WebSocket
- Clips are base64-encoded inline (no separate upload endpoint)
