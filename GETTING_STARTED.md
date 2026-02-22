# Getting Started

Angel Box is a real-time violence detection system with three components:

- **Edge** — Runs on a device with a camera (e.g. Jetson Nano). Captures video, detects people, estimates poses, scores threats, and streams everything to the backend over WebSocket.
- **Backend** — FastAPI server. Ingests detections, manages incidents/alerts in Postgres, transcodes video clips, and pushes real-time updates to the dashboard.
- **Angelboard (Frontend)** — React dashboard. Shows live camera feeds, alerts, incidents, and recorded clips.

---

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL database (or a hosted provider like Supabase)
- ffmpeg installed (`/usr/bin/ffmpeg`)
- A USB camera (for the edge device)
- (Optional) cloudflared for remote tunneling

---

## 1. Backend

```bash
cd backend
```

### Install dependencies

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Configure environment

Create a `.env` file in `backend/`:

```env
APP_ENV=dev
HOST=0.0.0.0
PORT=8000

DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname

CORS_ORIGINS=http://localhost:5173

THREAT_SCORE_THRESHOLD=0.75
INCIDENT_DEBOUNCE_SECONDS=10
ALERT_COOLDOWN_SECONDS=60

SAVE_FRAMES=true
EVIDENCE_DIR=./data/evidence
SAVE_CLIPS=true
CLIPS_DIR=./data/clips
MAX_CLIP_SIZE_BYTES=50000000

ENABLE_GEMINI=false
GEMINI_API_KEY=
```

### Create database tables

The backend uses SQLAlchemy. Tables are created automatically on first run if they don't exist. If you need to reset:

```bash
source venv/bin/activate
python3 -c "from app.db import engine, Base; from app import models; Base.metadata.create_all(engine)"
```

### Run

```bash
source venv/bin/activate
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

On startup, the backend will transcode any existing `.avi` clips in the clips directory to `.mp4`. This may take a minute if there are many clips.

The backend exposes:
- `GET /health` — health check
- `GET /clips` — list all clips (with incident correlation)
- `POST /clips/upload` — upload a clip
- `POST /detections` — ingest a detection
- `POST /edge/alerts` — ingest edge alerts
- `WS /ws/edge` — edge device WebSocket
- `WS /ws/dashboard` — dashboard WebSocket
- `/media/clips/` — static file serving for clips

---

## 2. Angelboard (Frontend)

```bash
cd angelboard
```

### Install dependencies

```bash
npm install
```

### Configure environment

Create a `.env` file in `angelboard/`:

```env
VITE_API_URL=http://localhost:8000
```

If the backend is exposed via a tunnel or remote URL, use that instead:

```env
VITE_API_URL=https://your-tunnel-url.trycloudflare.com
```

### Run

```bash
npm run dev
```

Opens at `http://localhost:5173`.

### Build for production

```bash
npm run build
npm run preview
```

---

## 3. Edge Device

```bash
cd edge
```

### Install dependencies

The edge requires OpenCV, Ultralytics (YOLOv8), and MediaPipe. Install into a virtualenv:

```bash
python3 -m venv venv
source venv/bin/activate
pip install opencv-python ultralytics mediapipe websockets scikit-learn numpy
```

The YOLOv8 model (`yolov8n.pt`) is included in the repo. The MediaPipe pose model (`pose_landmarker_lite.task`) will be auto-downloaded on first run if missing.

### Configure environment

Set these environment variables before running:

```bash
# WebSocket URL pointing to the backend
export EDGE_WS_URL=ws://localhost:8000/ws/edge

# Device identifier (string, sent to backend)
export EDGE_DEVICE_ID=edge_camera_01

# Camera index (check with: ls /dev/video*)
export EDGE_CAMERA_INDEX=0

# Optional: GPS coordinates for the camera location
export EDGE_LATITUDE=40.7128
export EDGE_LONGITUDE=-74.0060
```

### Run

```bash
source venv/bin/activate
python3 main.py
```

This opens a window showing the live camera feed with pose overlays and threat scoring. Detections are streamed to the backend in real time. When a threat is detected (score >= 0.75), the edge records a video clip and sends it to the backend.

### Headless mode

If running on a headless device (no display), you may need to set:

```bash
export DISPLAY=:0
# or suppress the OpenCV window in the code
```

---

## 4. Remote Access (Cloudflare Tunnel)

If the edge device and backend are on different networks, use a Cloudflare tunnel to expose the backend:

```bash
cd edge
./tunnel.sh
```

This starts a free quick tunnel. Look for the line with `https://<random>.trycloudflare.com` in the output, then configure the edge:

```bash
export EDGE_WS_URL=wss://<random>.trycloudflare.com/ws/edge
```

And the frontend:

```env
VITE_API_URL=https://<random>.trycloudflare.com
```

---

## Running Everything Together

Open three terminals:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd angelboard
npm run dev
```

**Terminal 3 — Edge:**
```bash
cd edge
source venv/bin/activate
export EDGE_WS_URL=ws://localhost:8000/ws/edge
export EDGE_CAMERA_INDEX=0
python3 main.py
```

Then open `http://localhost:5173` in your browser to see the dashboard.
