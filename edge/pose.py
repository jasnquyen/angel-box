import cv2
import mediapipe as mp
from ultralytics import YOLO

model = YOLO("yolov8n.pt")
mp_pose = mp.solutions.pose
pose = mp_pose.Pose(min_detection_confidence=0.5)
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    results = model(frame, classes=[0], conf=0.5)

    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        # crop person and run pose estimation
        person_crop = frame[y1:y2, x1:x2]
        if person_crop.size == 0:
            continue

        rgb_crop = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        pose_results = pose.process(rgb_crop)

        if pose_results.pose_landmarks:
            mp_draw.draw_landmarks(
                person_crop,
                pose_results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS
            )

        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

    cv2.imshow("pose", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()