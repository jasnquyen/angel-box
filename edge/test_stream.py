"""Test the edge streamer against test_ws_server.py.

Run test_ws_server.py first, then run this script.
"""

import cv2

from schema import build_detection_message
from streamer import StreamerBridge

streamer = StreamerBridge(server_url="ws://localhost:8000/ws/edge")
streamer.connect()

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("ERROR: cannot open webcam")
    exit(1)

print("Streaming to backend. Q to quit.")
frame_count = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Build detection message with dummy data
    people_data = [
        {
            "person_id": 0,
            "bbox": [100, 100, 200, 300],
            "is_horizontal": False,
            "arm_velocity": 5.0,
            "body_velocity": 2.0,
        }
    ]
    msg = build_detection_message(
        frame=frame,
        people_data=people_data,
        max_threat=0.3,
        threat_level="LOW",
        threat_reasons=["test reason"],
        mode="heuristic",
    )
    streamer.send(msg)

    # Check for incoming messages from backend
    inbox = streamer.get_inbox()
    for m in inbox:
        print(f"  INBOX: {m}")

    frame_count += 1
    cv2.putText(frame, f"Sent: {frame_count}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    cv2.imshow("Stream Test", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
streamer.close()
cv2.destroyAllWindows()
print(f"Done. Sent {frame_count} frames.")
