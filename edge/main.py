# main.py
import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from ultralytics import YOLO
import numpy as np
from collections import defaultdict, deque
from itertools import combinations
import urllib.request
import os



MODEL_PATH = "pose_landmarker_lite.task"
if not os.path.exists(MODEL_PATH):
    print("Downloading pose model...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
        MODEL_PATH
    )

yolo = YOLO("yolov8n.pt")

base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
options = vision.PoseLandmarkerOptions(base_options=base_options, num_poses=1)
landmarker = vision.PoseLandmarker.create_from_options(options)

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

# MediaPipe landmark indices
LEFT_WRIST = 15
RIGHT_WRIST = 16
LEFT_SHOULDER = 11
RIGHT_SHOULDER = 12
LEFT_HIP = 23
RIGHT_HIP = 24


class PersonTracker:
    def __init__(self, history_length=30):
        self.tracks = defaultdict(lambda: deque(maxlen=history_length))

    def get_person_id(self, bbox, threshold=80):
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2

        for pid, history in self.tracks.items():
            if len(history) > 0:
                last = history[-1]["centroid"]
                dist = np.sqrt((cx - last[0])**2 + (cy - last[1])**2)
                if dist < threshold:
                    return pid

        return len(self.tracks)

    def update(self, person_id, bbox, landmarks):
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2

        self.tracks[person_id].append({
            "centroid": (cx, cy),
            "bbox": bbox,
            "landmarks": landmarks,
        })

    def get_velocity(self, person_id):
        track = self.tracks[person_id]
        if len(track) < 2:
            return 0.0
        prev = track[-2]["centroid"]
        curr = track[-1]["centroid"]
        return np.sqrt((curr[0] - prev[0])**2 + (curr[1] - prev[1])**2)

# ============================================================
# FEATURE EXTRACTION
# ============================================================


def extract_pose_features(landmarks):
    if landmarks is None:
        return None

    lm = landmarks

    left_wrist_y = lm[LEFT_WRIST].y
    left_wrist_x = lm[LEFT_WRIST].x
    left_shoulder_y = lm[LEFT_SHOULDER].y
    right_wrist_y = lm[RIGHT_WRIST].y
    right_wrist_x = lm[RIGHT_WRIST].x
    right_shoulder_y = lm[RIGHT_SHOULDER].y

    left_arm_raised = left_wrist_y < left_shoulder_y
    right_arm_raised = right_wrist_y < right_shoulder_y

    left_arm_elevation = max(0, left_shoulder_y - left_wrist_y)
    right_arm_elevation = max(0, right_shoulder_y - right_wrist_y)

    # torso orientation
    left_hip_y = lm[LEFT_HIP].y
    left_hip_x = lm[LEFT_HIP].x
    left_shoulder_x = lm[LEFT_SHOULDER].x

    torso_vertical = abs(left_hip_y - left_shoulder_y)
    torso_horizontal = abs(left_hip_x - left_shoulder_x)
    torso_angle = torso_vertical / (torso_horizontal + 1e-6)

    # more forgiving horizontal check
    is_horizontal = torso_angle < 1.5

    # wrist positions (normalized 0-1) for velocity tracking
    return {
        "left_arm_raised": left_arm_raised,
        "right_arm_raised": right_arm_raised,
        "left_arm_elevation": left_arm_elevation,
        "right_arm_elevation": right_arm_elevation,
        "is_horizontal": is_horizontal,
        "torso_angle": torso_angle,
        "left_wrist": (left_wrist_x, left_wrist_y),
        "right_wrist": (right_wrist_x, right_wrist_y),
    }


# ============================================================
# THREAT SCORING
# ============================================================
class ThreatScorer:

    def __init__(self):
        self.wrist_history = defaultdict(lambda: deque(maxlen=15))

    def get_arm_velocity(self, person_id, features):
        """track how fast wrists are moving between frames"""
        if features is None:
            return 0.0

        current = (
            features["left_wrist"][0], features["left_wrist"][1],
            features["right_wrist"][0], features["right_wrist"][1],
        )

        history = self.wrist_history[person_id]
        history.append(current)

        if len(history) < 2:
            return 0.0

        prev = history[-2]
        left_vel = np.sqrt((current[0] - prev[0])**2 + (current[1] - prev[1])**2)
        right_vel = np.sqrt((current[2] - prev[2])**2 + (current[3] - prev[3])**2)

        return max(left_vel, right_vel)

    def score_pair(self, person_a, person_b, tracker):
        score = 0.0
        reasons = []

        id_a, feat_a, bbox_a = person_a
        id_b, feat_b, bbox_b = person_b

        if feat_a is None or feat_b is None:
            return 0.0, []

        # --- proximity (use bbox width to scale dynamically) ---
        cx_a = (bbox_a[0] + bbox_a[2]) / 2
        cx_b = (bbox_b[0] + bbox_b[2]) / 2
        cy_a = (bbox_a[1] + bbox_a[3]) / 2
        cy_b = (bbox_b[1] + bbox_b[3]) / 2
        distance = np.sqrt((cx_a - cx_b)**2 + (cy_a - cy_b)**2)

        # scale proximity threshold based on person size
        # (bigger bounding box = closer to camera = need larger threshold)
        avg_width = ((bbox_a[2] - bbox_a[0]) + (bbox_b[2] - bbox_b[0])) / 2
        proximity_threshold = avg_width * 3

        if distance > proximity_threshold:
            return 0.0, []

        proximity_score = max(0, (proximity_threshold - distance) / proximity_threshold) * 0.25
        score += proximity_score
        if proximity_score > 0.05:
            reasons.append(f"close proximity ({distance:.0f}px, thresh:{proximity_threshold:.0f})")

        # --- one person on ground, other standing ---
        if feat_a["is_horizontal"] and not feat_b["is_horizontal"]:
            score += 0.4
            reasons.append("person A on ground, B standing")
        elif feat_b["is_horizontal"] and not feat_a["is_horizontal"]:
            score += 0.4
            reasons.append("person B on ground, A standing")

        # --- raised arms ---
        arms_raised_a = feat_a["left_arm_raised"] or feat_a["right_arm_raised"]
        arms_raised_b = feat_b["left_arm_raised"] or feat_b["right_arm_raised"]

        if arms_raised_a and arms_raised_b:
            score += 0.2
            reasons.append("both have raised arms")
        elif arms_raised_a or arms_raised_b:
            score += 0.15
            reasons.append("one person has raised arms")

        # --- arm velocity (stabbing, punching, swinging) ---
        arm_vel_a = self.get_arm_velocity(id_a, feat_a)
        arm_vel_b = self.get_arm_velocity(id_b, feat_b)
        max_arm_vel = max(arm_vel_a, arm_vel_b)

        if max_arm_vel > 0.55:
            score += 0.3
            reasons.append(f"violent arm motion ({max_arm_vel:.3f})")
        elif max_arm_vel > 0.30:
            score += 0.15
            reasons.append(f"aggressive arm motion ({max_arm_vel:.3f})")

        # --- body velocity (rushing, charging) ---
        vel_a = tracker.get_velocity(id_a)
        vel_b = tracker.get_velocity(id_b)

        if vel_a > 20 or vel_b > 20:
            score += 0.2
            reasons.append(f"rapid movement (vel: {vel_a:.0f}, {vel_b:.0f})")
        elif vel_a > 10 or vel_b > 10:
            score += 0.1
            reasons.append(f"moderate movement (vel: {vel_a:.0f}, {vel_b:.0f})")

        # --- closing distance ---
        track_a = tracker.tracks[id_a]
        track_b = tracker.tracks[id_b]

        if len(track_a) > 10 and len(track_b) > 10:
            old_dist = np.sqrt(
                (track_a[-10]["centroid"][0] - track_b[-10]["centroid"][0])**2 +
                (track_a[-10]["centroid"][1] - track_b[-10]["centroid"][1])**2
            )
            closing_rate = old_dist - distance
            if closing_rate > 30:
                score += 0.15
                reasons.append(f"closing distance ({closing_rate:.0f}px in 10 frames)")

        return min(score, 1.0), reasons

    def score_solo(self, person_id, features, tracker):
        score = 0.0
        reasons = []

        if features is None:
            return 0.0, []

        if features["is_horizontal"]:
            score += 0.4
            reasons.append(f"person horizontal (angle: {features['torso_angle']:.2f})")

            track = tracker.tracks[person_id]
            if len(track) > 15:
                recent_velocities = [
                    np.sqrt(
                        (track[i]["centroid"][0] - track[i-1]["centroid"][0])**2 +
                        (track[i]["centroid"][1] - track[i-1]["centroid"][1])**2
                    )
                    for i in range(-15, 0)
                ]
                if max(recent_velocities) < 5:
                    score += 0.35
                    reasons.append("motionless on ground for extended period")

        return min(score, 1.0), reasons

tracker = PersonTracker()
scorer = ThreatScorer()
frame_buffer = deque(maxlen=450)  # 30 sec at 15fps

cap = cv2.VideoCapture(0)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_buffer.append(frame.copy())

    results = yolo(frame, classes=[0], conf=0.5)

    people = []

    for box in results[0].boxes:
        bbox = list(map(int, box.xyxy[0]))
        x1, y1, x2, y2 = bbox

        person_crop = frame[y1:y2, x1:x2]
        if person_crop.size == 0:
            continue

        # run pose estimation
        rgb_crop = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_crop)
        pose_results = landmarker.detect(mp_image)

        landmarks = None
        features = None

        if pose_results.pose_landmarks:
            landmarks = pose_results.pose_landmarks[0]
            features = extract_pose_features(landmarks)


            # draw skeleton on crop
            h, w = person_crop.shape[:2]
            points = []
            for lm in landmarks:
                px, py = int(lm.x * w), int(lm.y * h)
                points.append((px, py))
                cv2.circle(person_crop, (px, py), 3, (0, 255, 0), -1)

            for start, end in POSE_CONNECTIONS:
                if start < len(points) and end < len(points):
                    cv2.line(person_crop, points[start], points[end], (0, 255, 0), 2)

        person_id = tracker.get_person_id(bbox)
        tracker.update(person_id, bbox, landmarks)
        people.append((person_id, features, bbox))

        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(frame, f"ID:{person_id}", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        # TODO: remove later
        if features:
            print(
                f"ID:{person_id} torso_angle:{features['torso_angle']:.2f} horizontal:{features['is_horizontal']} arms_L:{features['left_arm_raised']} arms_R:{features['right_arm_raised']}")


    # --- threat scoring ---
    max_threat = 0.0
    threat_reasons = []

    for a, b in combinations(people, 2):
        pair_score, reasons = scorer.score_pair(a, b, tracker)
        if pair_score > max_threat:
            max_threat = pair_score
            threat_reasons = reasons

    for pid, feat, bbox in people:
        solo_score, reasons = scorer.score_solo(pid, feat, tracker)
        if solo_score > max_threat:
            max_threat = solo_score
            threat_reasons = reasons

    # --- display ---
    if max_threat >= 0.75:
        level, color = "HIGH", (0, 0, 255)
    elif max_threat >= 0.5:
        level, color = "MEDIUM", (0, 165, 255)
    elif max_threat >= 0.3:
        level, color = "LOW", (0, 255, 255)
    else:
        level, color = "NONE", (0, 255, 0)

    cv2.putText(frame, f"Threat: {level} ({max_threat:.2f})",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

    for i, reason in enumerate(threat_reasons):
        cv2.putText(frame, reason, (10, 60 + i * 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

    cv2.imshow("Campus Guardian", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()