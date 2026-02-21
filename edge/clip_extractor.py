"""Clip extractor — stitches pre/active/post event phases into one file."""

import os
from datetime import datetime

import cv2


class ClipExtractor:
    """Captures incident clips with pre-event, active, and post-event phases."""

    def __init__(self, output_dir="clips/", post_event_seconds=60, fps=15):
        self.output_dir = output_dir
        self.post_event_seconds = post_event_seconds
        self.fps = fps

        self.is_recording = False
        self.current_writer = None
        self.current_clip_path = None
        self.post_event_countdown = 0
        self.phase = "idle"

        self._fourcc = cv2.VideoWriter_fourcc(*"XVID")

        os.makedirs(self.output_dir, exist_ok=True)

    def on_frame(self, frame, threat_active):
        if self.phase == "idle":
            if not threat_active:
                return None
            # Start new incident clip
            self.phase = "active"
            self.is_recording = True
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            self.current_clip_path = os.path.join(
                self.output_dir, f"incident_{ts}.avi")
            h, w = frame.shape[:2]
            self.current_writer = cv2.VideoWriter(
                self.current_clip_path, self._fourcc, self.fps, (w, h))
            self.current_writer.write(frame)
            return {"event": "started", "clip_path": self.current_clip_path}

        if self.phase == "active":
            if threat_active:
                self.current_writer.write(frame)
                return None
            # Threat ended, begin post-event capture
            self.phase = "post_event"
            self.post_event_countdown = self.post_event_seconds * self.fps
            self.current_writer.write(frame)
            return {"event": "post_event_started"}

        if self.phase == "post_event":
            if threat_active:
                self.phase = "active"
                self.current_writer.write(frame)
                return {"event": "threat_resumed"}
            self.current_writer.write(frame)
            self.post_event_countdown -= 1
            if self.post_event_countdown <= 0:
                clip_path = self.finalize()
                return {"event": "completed", "clip_path": clip_path}
            return None

        return None

    def write_pre_event(self, frames):
        if self.current_writer is not None:
            for f in frames:
                self.current_writer.write(f)

    def finalize(self):
        path = self.current_clip_path
        if self.current_writer is not None:
            self.current_writer.release()
            self.current_writer = None
        self.is_recording = False
        self.current_clip_path = None
        self.post_event_countdown = 0
        self.phase = "idle"
        return path
