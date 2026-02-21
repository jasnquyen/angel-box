import numpy as np
from collections import defaultdict, deque


class PersonTracker:
    """track people across frames and extract behavioral features"""

    def __init__(self, history_length=30):
        # store centroid history per person (keyed by rough position)
        self.tracks = defaultdict(lambda: deque(maxlen=history_length))

    def get_person_id(self, bbox, threshold=80):
        """simple nearest-centroid matching (not production quality but fine for demo)"""
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2

        for pid, history in self.tracks.items():
            if len(history) > 0:
                last = history[-1]["centroid"]
                dist = np.sqrt((cx - last[0]) ** 2 + (cy - last[1]) ** 2)
                if dist < threshold:
                    return pid

        # new person
        new_id = len(self.tracks)
        return new_id

    def update(self, person_id, bbox, landmarks):
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2

        self.tracks[person_id].append({
            "centroid": (cx, cy),
            "bbox": bbox,
            "landmarks": landmarks,
        })

    def get_velocity(self, person_id):
        """pixels per frame movement"""
        track = self.tracks[person_id]
        if len(track) < 2:
            return 0.0
        prev = track[-2]["centroid"]
        curr = track[-1]["centroid"]
        return np.sqrt((curr[0] - prev[0]) ** 2 + (curr[1] - prev[1]) ** 2)


def extract_pose_features(landmarks):
    """pull useful signals from mediapipe landmarks"""

    if landmarks is None:
        return None

    lm = landmarks.landmark

    # wrist positions relative to shoulders (are arms raised?)
    left_wrist_y = lm[mp_pose.PoseLandmark.LEFT_WRIST].y
    left_shoulder_y = lm[mp_pose.PoseLandmark.LEFT_SHOULDER].y
    right_wrist_y = lm[mp_pose.PoseLandmark.RIGHT_WRIST].y
    right_shoulder_y = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER].y

    left_arm_raised = left_wrist_y < left_shoulder_y
    right_arm_raised = right_wrist_y < right_shoulder_y

    # how high are arms above shoulders (normalized)
    left_arm_elevation = max(0, left_shoulder_y - left_wrist_y)
    right_arm_elevation = max(0, right_shoulder_y - right_wrist_y)

    # hip-to-shoulder ratio for detecting if someone is on the ground
    left_hip_y = lm[mp_pose.PoseLandmark.LEFT_HIP].y
    left_shoulder_y = lm[mp_pose.PoseLandmark.LEFT_SHOULDER].y
    torso_height = abs(left_hip_y - left_shoulder_y)

    # if torso is nearly horizontal, person might be on the ground
    left_hip_x = lm[mp_pose.PoseLandmark.LEFT_HIP].x
    left_shoulder_x = lm[mp_pose.PoseLandmark.LEFT_SHOULDER].x
    torso_angle = abs(left_hip_y - left_shoulder_y) / (abs(left_hip_x - left_shoulder_x) + 1e-6)
    is_horizontal = torso_angle < 1.0  # roughly 45 degrees or less

    return {
        "left_arm_raised": left_arm_raised,
        "right_arm_raised": right_arm_raised,
        "left_arm_elevation": left_arm_elevation,
        "right_arm_elevation": right_arm_elevation,
        "is_horizontal": is_horizontal,
        "torso_angle": torso_angle,
    }