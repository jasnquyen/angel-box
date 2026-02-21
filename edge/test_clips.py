"""Standalone test for the clip pipeline (PreEventBuffer + ClipExtractor).

Hold SPACE to simulate a threat, release to stop. Q to quit.
Clips are saved to test_clips/ (wiped on each run).
"""

import os
import shutil

import cv2

from clip_buffer import PreEventBuffer
from clip_extractor import ClipExtractor

OUTPUT_DIR = "test_clips/"

# Clean slate
if os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)

pre_buffer = PreEventBuffer(buffer_seconds=3, fps=15)
extractor = ClipExtractor(output_dir=OUTPUT_DIR, post_event_seconds=3, fps=15)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("ERROR: cannot open webcam")
    exit(1)

print("Hold SPACE = threat active | Release = no threat | Q = quit")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    pre_buffer.add_frame(frame)

    key = cv2.waitKey(1) & 0xFF
    if key == ord("q"):
        break

    threat_active = key == ord(" ")

    event = extractor.on_frame(frame, threat_active)

    if event is not None:
        if event["event"] == "started":
            extractor.write_pre_event(pre_buffer.get_frames())
        print(f"  EVENT: {event}")

    # Overlay
    color = (0, 0, 255) if threat_active else (0, 255, 0)
    status = f"Phase: {extractor.phase} | Threat: {'YES' if threat_active else 'no'}"
    cv2.putText(frame, status, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
    if extractor.post_event_countdown > 0:
        remaining = extractor.post_event_countdown / extractor.fps
        cv2.putText(frame, f"Post-event: {remaining:.1f}s", (10, 60),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
    cv2.imshow("Clip Pipeline Test", frame)

cap.release()
extractor.finalize()
cv2.destroyAllWindows()

print(f"\nFiles in {OUTPUT_DIR}:")
if os.path.exists(OUTPUT_DIR):
    for f in sorted(os.listdir(OUTPUT_DIR)):
        size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
        print(f"  {f}  ({size / 1024:.1f} KB)")
else:
    print("  (none)")
