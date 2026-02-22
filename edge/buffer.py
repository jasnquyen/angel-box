"""Rolling video buffer — continuous recording to disk in segments."""

import os
from datetime import datetime, timedelta

import cv2


class RollingBuffer:
    """Continuously saves video to disk in fixed-length segments,
    automatically deleting segments older than max_age_hours."""

    FILENAME_FMT = "segment_%Y%m%d_%H%M%S.avi"

    def __init__(self, save_dir="recordings/", fps=15,
                 segment_duration_seconds=600, max_age_hours=24):
        self.save_dir = save_dir
        self.fps = fps
        self.segment_duration_seconds = segment_duration_seconds
        self.max_age_hours = max_age_hours

        self._writer = None
        self._segment_start = None
        self._fourcc = cv2.VideoWriter_fourcc(*"XVID")

        os.makedirs(self.save_dir, exist_ok=True)

    def write_frame(self, frame):
        now = datetime.now()
        if (self._writer is None
                or (now - self._segment_start).total_seconds() >= self.segment_duration_seconds):
            self._start_new_segment(frame)
        self._writer.write(frame)

    def _start_new_segment(self, frame):
        if self._writer is not None:
            self._writer.release()

        self._segment_start = datetime.now()
        filename = self._segment_start.strftime(self.FILENAME_FMT)
        path = os.path.join(self.save_dir, filename)

        h, w = frame.shape[:2]
        self._writer = cv2.VideoWriter(path, self._fourcc, self.fps, (w, h))

        self._cleanup()

    def _cleanup(self):
        cutoff = datetime.now() - timedelta(hours=self.max_age_hours)
        for fname in os.listdir(self.save_dir):
            if not fname.endswith(".avi") or not fname.startswith("segment_"):
                continue
            try:
                ts = datetime.strptime(fname, self.FILENAME_FMT)
            except ValueError:
                continue
            if ts < cutoff:
                os.remove(os.path.join(self.save_dir, fname))

    def release(self):
        if self._writer is not None:
            self._writer.release()
            self._writer = None
