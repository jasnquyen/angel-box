# pose.py
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from ultralytics import YOLO
import urllib.request
import os

# download pose model if not present
MODEL_PATH = "pose_landmarker_lite.task"
if not os.path.exists(MODEL_PATH):
    print("Downloading pose model...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        MODEL_PATH
    )

model = YOLO("yolov8n.pt")

# new mediapipe API
base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    num_poses=1
)
landmarker = vision.PoseLandmarker.create_from_options(options)

cap = cv2.VideoCapture(0)

# landmark connections for drawing skeleton
POSE_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10), (11, 12), (11, 13), (13, 15),
    (12, 14), (14, 16), (15, 17), (16, 18),
    (15, 19), (16, 20), (15, 21), (16, 22),
    (11, 23), (12, 24), (23, 24), (23, 25),
    (24, 26), (25, 27), (26, 28), (27, 29),
    (28, 30), (29, 31), (30, 32),
]

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, classes=[0], conf=0.5)

    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        person_crop = frame[y1:y2, x1:x2]
        if person_crop.size == 0:
            continue

        # convert to mediapipe image
        rgb_crop = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_crop)

        pose_results = landmarker.detect(mp_image)

        if pose_results.pose_landmarks:
            landmarks = pose_results.pose_landmarks[0]
            h, w = person_crop.shape[:2]

            # draw keypoints
            points = []
            for lm in landmarks:
                px, py = int(lm.x * w), int(lm.y * h)
                points.append((px, py))
                cv2.circle(person_crop, (px, py), 3, (0, 255, 0), -1)

            # draw skeleton
            for start, end in POSE_CONNECTIONS:
                if start < len(points) and end < len(points):
                    cv2.line(person_crop, points[start], points[end], (0, 255, 0), 2)

        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

    cv2.imshow("pose", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()