"""In-memory pre-event buffer — keeps the last N seconds of frames in RAM."""

from collections import deque


class PreEventBuffer:
    """Fixed-size ring buffer of video frames backed by collections.deque."""

    def __init__(self, buffer_seconds=30, fps=15):
        self._buf = deque(maxlen=buffer_seconds * fps)

    def add_frame(self, frame):
        self._buf.append(frame.copy())

    def get_frames(self):
        return list(self._buf)

    def clear(self):
        self._buf.clear()
