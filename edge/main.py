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
from classifier import build_pair_feature_vector



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

    # horizontal = torso wider than tall (actually lying down, not just sitting/leaning)
    is_horizontal = torso_angle < 0.8

    # shoulder, hip, and body center (needed for directional velocity)
    right_hip_y = lm[RIGHT_HIP].y
    right_hip_x = lm[RIGHT_HIP].x
    right_shoulder_x = lm[RIGHT_SHOULDER].x

    body_center_x = (left_shoulder_x + right_shoulder_x + left_hip_x + right_hip_x) / 4
    body_center_y = (left_shoulder_y + right_shoulder_y + left_hip_y + right_hip_y) / 4

    # wrist visibility (low = MediaPipe is guessing, causes jitter)
    left_wrist_vis = lm[LEFT_WRIST].visibility
    right_wrist_vis = lm[RIGHT_WRIST].visibility

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
        "left_wrist_vis": left_wrist_vis,
        "right_wrist_vis": right_wrist_vis,
        "left_shoulder": (left_shoulder_x, left_shoulder_y),
        "right_shoulder": (right_shoulder_x, right_shoulder_y),
        "left_hip": (left_hip_x, left_hip_y),
        "right_hip": (right_hip_x, right_hip_y),
        "body_center": (body_center_x, body_center_y),
    }


# ============================================================
# THREAT SCORING
# ============================================================
class ThreatScorer:

    def __init__(self):
        self.wrist_history = defaultdict(lambda: deque(maxlen=15))
        self.arm_velocity_history = defaultdict(lambda: deque(maxlen=15))
        self.body_velocity_history = defaultdict(lambda: deque(maxlen=15))
        self.smoothed_scores = defaultdict(float)
        self.score_window = defaultdict(lambda: deque(maxlen=3))  # median filter window
        self.strike_events = defaultdict(list)
        self.frame_count = 0
        self.last_pair_data = None

    def _to_frame_space(self, norm_pos, bbox):
        """Convert normalized-within-crop coordinates to frame-space pixels."""
        x1, y1, x2, y2 = bbox
        return (x1 + norm_pos[0] * (x2 - x1), y1 + norm_pos[1] * (y2 - y1))

    def get_directional_arm_velocity(self, person_id, features, bbox, other_body_center_frame):
        """Compute directional arm velocity — the key discriminator between gestures and strikes.

        Returns dict with:
          directed_vel: velocity component aimed at the other person's body
          lateral_vel: velocity component perpendicular (gestures)
          acceleration: change in speed from previous frame
          raw_vel: total speed
        """
        zero = {"directed_vel": 0.0, "lateral_vel": 0.0, "acceleration": 0.0, "raw_vel": 0.0}
        if features is None:
            return zero

        # Gate on wrist visibility — low confidence means MediaPipe is guessing,
        # which causes skeleton jitter that reads as fake high velocity
        VIS_THRESH = 0.65
        left_visible = features["left_wrist_vis"] >= VIS_THRESH
        right_visible = features["right_wrist_vis"] >= VIS_THRESH
        if not left_visible and not right_visible:
            return zero

        # Convert wrist positions to frame space
        lw_frame = self._to_frame_space(features["left_wrist"], bbox)
        rw_frame = self._to_frame_space(features["right_wrist"], bbox)

        current = (lw_frame[0], lw_frame[1], rw_frame[0], rw_frame[1])
        history = self.wrist_history[person_id]
        history.append(current)

        if len(history) < 2:
            return zero

        prev = history[-2]

        # Velocity vectors for each wrist (zero out invisible wrists)
        left_vel_vec = np.array([current[0] - prev[0], current[1] - prev[1]]) if left_visible else np.zeros(2)
        right_vel_vec = np.array([current[2] - prev[2], current[3] - prev[3]]) if right_visible else np.zeros(2)
        left_speed = np.linalg.norm(left_vel_vec)
        right_speed = np.linalg.norm(right_vel_vec)

        # Jitter clamp: no wrist can move more than the crop width in one frame
        crop_w = bbox[2] - bbox[0]
        if left_speed > crop_w:
            left_vel_vec = np.zeros(2)
            left_speed = 0.0
        if right_speed > crop_w:
            right_vel_vec = np.zeros(2)
            right_speed = 0.0

        # Use the faster-moving visible wrist
        if left_speed >= right_speed:
            vel_vec = left_vel_vec
            wrist_frame = lw_frame
            raw_vel = left_speed
        else:
            vel_vec = right_vel_vec
            wrist_frame = rw_frame
            raw_vel = right_speed

        # Direction from wrist to other person's body center
        to_target = np.array([other_body_center_frame[0] - wrist_frame[0],
                              other_body_center_frame[1] - wrist_frame[1]])
        target_dist = np.linalg.norm(to_target)

        if target_dist < 1e-6 or raw_vel < 1e-6:
            return {**zero, "raw_vel": raw_vel}

        to_target_unit = to_target / target_dist

        # Directed component: projection onto target direction (only toward, not away)
        directed_vel = max(0.0, float(np.dot(vel_vec, to_target_unit)))

        # Lateral component: perpendicular to target direction
        lateral_vel = abs(float(np.cross(to_target_unit, vel_vec)))

        # Acceleration: change in speed from previous frame
        arm_vel_hist = self.arm_velocity_history[person_id]
        prev_speed = arm_vel_hist[-1] if len(arm_vel_hist) > 0 else 0.0
        acceleration = raw_vel - prev_speed
        arm_vel_hist.append(raw_vel)

        return {
            "directed_vel": directed_vel,
            "lateral_vel": lateral_vel,
            "acceleration": acceleration,
            "raw_vel": raw_vel,
        }

    def _detect_impact_response(self, attacker_id, victim_id, tracker):
        """Check if victim's body velocity suddenly spikes after attacker's arm strike (recoil/flinch)."""
        recent_strikes = [e for e in self.strike_events[attacker_id]
                          if self.frame_count - e["frame"] < 10]
        if not recent_strikes:
            return False

        body_vel_hist = self.body_velocity_history[victim_id]
        if len(body_vel_hist) < 3:
            return False

        hist_list = list(body_vel_hist)
        baseline = np.mean(hist_list[:-2]) if len(hist_list) > 2 else 0.0
        recent_peak = max(hist_list[-2:])

        return recent_peak > baseline * 2.0 + 5

    def _smooth_score(self, pair_key, raw_score):
        """Median filter to kill single-frame spikes, then EMA with moderate decay."""
        # Median filter — kills single-frame background spikes
        window = self.score_window[pair_key]
        window.append(raw_score)
        med_score = sorted(window)[len(window) // 2]

        prev = self.smoothed_scores[pair_key]
        if med_score > prev:
            # Near-instant rise, but use max of raw and median so punches aren't clipped
            smoothed = 0.95 * max(med_score, raw_score * 0.8) + 0.05 * prev
        else:
            smoothed = prev * 0.98  # 2%/frame decay → ~2s to halve at 30fps
        self.smoothed_scores[pair_key] = smoothed
        return smoothed

    def score_pair(self, person_a, person_b, tracker):
        reasons = []

        id_a, feat_a, bbox_a = person_a
        id_b, feat_b, bbox_b = person_b
        pair_key = (min(id_a, id_b), max(id_a, id_b))

        if feat_a is None or feat_b is None:
            return self._smooth_score(pair_key, 0.0), []

        # --- proximity gate ---
        cx_a = (bbox_a[0] + bbox_a[2]) / 2
        cx_b = (bbox_b[0] + bbox_b[2]) / 2
        cy_a = (bbox_a[1] + bbox_a[3]) / 2
        cy_b = (bbox_b[1] + bbox_b[3]) / 2
        distance = np.sqrt((cx_a - cx_b)**2 + (cy_a - cy_b)**2)

        avg_width = ((bbox_a[2] - bbox_a[0]) + (bbox_b[2] - bbox_b[0])) / 2
        proximity_threshold = avg_width * 3

        if distance > proximity_threshold:
            return self._smooth_score(pair_key, 0.0), []

        # ============================================================
        # CONTEXT COMPONENT (0.0 - 0.35)
        # Scene setup: proximity (small), person on ground
        # ============================================================
        context_score = 0.0

        proximity_factor = max(0, (proximity_threshold - distance) / proximity_threshold)
        prox_contrib = proximity_factor * 0.10
        context_score += prox_contrib
        if prox_contrib > 0.02:
            reasons.append(f"proximity ({distance:.0f}px)")

        if feat_a["is_horizontal"] and not feat_b["is_horizontal"]:
            context_score += 0.25
            reasons.append("person A on ground, B standing")
        elif feat_b["is_horizontal"] and not feat_a["is_horizontal"]:
            context_score += 0.25
            reasons.append("person B on ground, A standing")

        context_score = min(context_score, 0.35)

        # ============================================================
        # VIOLENCE INDICATOR (0.0 - 0.65)
        # directed_velocity * directionality, amplified by accel + impact
        # ============================================================
        body_center_a = self._to_frame_space(feat_a["body_center"], bbox_a)
        body_center_b = self._to_frame_space(feat_b["body_center"], bbox_b)

        # Track body velocities for impact response detection
        # Clamp body velocity — bbox jitter from flickering legs causes fake spikes
        max_body_vel = avg_width * 0.5  # can't move half your width in one frame standing
        vel_a = min(tracker.get_velocity(id_a), max_body_vel)
        vel_b = min(tracker.get_velocity(id_b), max_body_vel)
        self.body_velocity_history[id_a].append(vel_a)
        self.body_velocity_history[id_b].append(vel_b)

        # Directional arm velocities
        arm_a = self.get_directional_arm_velocity(id_a, feat_a, bbox_a, body_center_b)
        arm_b = self.get_directional_arm_velocity(id_b, feat_b, bbox_b, body_center_a)

        # Use the more threatening arm motion
        if arm_a["directed_vel"] >= arm_b["directed_vel"]:
            primary_arm = arm_a
            attacker_id, victim_id = id_a, id_b
        else:
            primary_arm = arm_b
            attacker_id, victim_id = id_b, id_a

        directed = primary_arm["directed_vel"]
        raw = primary_arm["raw_vel"]
        accel = primary_arm["acceleration"]

        # Directionality: fraction of arm motion aimed at target
        directionality = directed / (raw + 1e-6)

        # Normalize directed velocity by 30% person width (scale-invariant)
        # At 30fps, a punch moves wrist ~15-40% of person width per frame
        ref_w = avg_width * 0.3 + 1e-6
        norm_directed = min(directed / ref_w, 1.0)

        # Strike score: directed speed, amplified by directionality
        # Floor of 0.1 — undirected motion barely counts; directionality is the gate
        strike_score = norm_directed * (0.1 + 0.9 * directionality)

        # Amplify by acceleration (explosive motion = punch)
        if accel > 0:
            norm_accel = min(accel / (avg_width * 0.15 + 1e-6), 1.0)
            strike_score *= (1.0 + norm_accel * 0.8)

        # Record strike event if significant
        if strike_score > 0.3:
            self.strike_events[attacker_id].append({
                "frame": self.frame_count,
                "score": strike_score,
            })

        # Impact response amplification
        if self._detect_impact_response(attacker_id, victim_id, tracker):
            strike_score *= 1.4
            reasons.append("impact response detected")

        violence_score = min(strike_score * 0.80, 0.80)

        if violence_score > 0.05:
            reasons.append(f"directed strike (dir:{directionality:.2f} spd:{norm_directed:.2f})")

        # ============================================================
        # GESTURE SUPPRESSION (-0.15)
        # Penalty when arm moves fast but NOT toward the target
        # ============================================================
        gesture_penalty = 0.0
        norm_raw = min(raw / ref_w, 1.0)
        if norm_raw > 0.15 and directionality < 0.3:
            gesture_penalty = -0.15 * (1.0 - directionality) * min(norm_raw / 0.5, 1.0)
            reasons.append(f"gesture suppression ({gesture_penalty:.2f})")

        # ============================================================
        # SUPPLEMENTARY (0.0 - 0.15)
        # Closing distance, body charging
        # ============================================================
        supplementary = 0.0
        closing_rate = 0.0

        track_a = tracker.tracks[id_a]
        track_b = tracker.tracks[id_b]

        if len(track_a) > 10 and len(track_b) > 10:
            old_dist = np.sqrt(
                (track_a[-10]["centroid"][0] - track_b[-10]["centroid"][0])**2 +
                (track_a[-10]["centroid"][1] - track_b[-10]["centroid"][1])**2
            )
            closing_rate = old_dist - distance
            if closing_rate > 30:
                supplementary += min(closing_rate / 100, 1.0) * 0.08
                reasons.append(f"closing distance ({closing_rate:.0f}px)")

        if vel_a > 15 or vel_b > 15:
            supplementary += min(max(vel_a, vel_b) / 50, 1.0) * 0.07
            reasons.append(f"body movement ({vel_a:.0f}, {vel_b:.0f})")

        supplementary = min(supplementary, 0.15)

        # ============================================================
        # COMBINE + SMOOTH
        # ============================================================
        raw_score = context_score + violence_score + supplementary + gesture_penalty
        raw_score = max(0.0, min(raw_score, 1.0))

        final_score = self._smooth_score(pair_key, raw_score)

        # TODO: remove debug print
        if final_score > 0.15:
            print(f"  SCORE ctx:{context_score:.2f} viol:{violence_score:.2f} "
                  f"supp:{supplementary:.2f} gest:{gesture_penalty:.2f} "
                  f"raw:{raw_score:.2f} smooth:{final_score:.2f} | "
                  f"dir:{directionality:.2f} nspd:{norm_directed:.2f} strike:{strike_score:.2f}")

        self.last_pair_data = {
            "arm_a": arm_a, "arm_b": arm_b,
            "vel_a": vel_a, "vel_b": vel_b,
            "closing_rate": closing_rate,
        }

        return final_score, reasons

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
last_feature_vec = None

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_buffer.append(frame.copy())
    scorer.frame_count += 1

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

        if scorer.last_pair_data is not None and a[1] is not None and b[1] is not None:
            id_a, feat_a, bbox_a = a
            id_b, feat_b, bbox_b = b
            d = scorer.last_pair_data
            fv = build_pair_feature_vector(
                feat_a, feat_b, bbox_a, bbox_b,
                d["arm_a"], d["arm_b"], d["vel_a"], d["vel_b"],
                d["closing_rate"],
            )
            last_feature_vec = fv
            print(f"  FV dist:{fv[0]:.2f} dir_a:{fv[21]:.2f} dir_b:{fv[22]:.2f} "
                  f"raw_a:{fv[13]:.1f} raw_b:{fv[14]:.1f} close:{fv[25]:.1f}")

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