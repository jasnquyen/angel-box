# threat.py
import numpy as np
from collections import deque


class ThreatScorer:

    def __init__(self):
        self.arm_velocity_history = defaultdict(lambda: deque(maxlen=15))

    def score_pair(self, person_a, person_b, tracker):
        """score threat level between two detected people"""

        score = 0.0
        reasons = []

        id_a, feat_a, bbox_a = person_a
        id_b, feat_b, bbox_b = person_b

        if feat_a is None or feat_b is None:
            return 0.0, []

        # --- proximity ---
        cx_a = (bbox_a[0] + bbox_a[2]) / 2
        cx_b = (bbox_b[0] + bbox_b[2]) / 2
        cy_a = (bbox_a[1] + bbox_a[3]) / 2
        cy_b = (bbox_b[1] + bbox_b[3]) / 2
        distance = np.sqrt((cx_a - cx_b) ** 2 + (cy_a - cy_b) ** 2)

        # people need to be close for it to be an altercation
        if distance > 300:  # pixels — tune this based on camera FOV
            return 0.0, []

        proximity_score = max(0, (300 - distance) / 300) * 0.2
        score += proximity_score
        if proximity_score > 0.1:
            reasons.append(f"close proximity ({distance:.0f}px)")

        # --- one person on the ground, other standing ---
        if feat_a["is_horizontal"] and not feat_b["is_horizontal"]:
            score += 0.35
            reasons.append("person A on ground, B standing")
        elif feat_b["is_horizontal"] and not feat_a["is_horizontal"]:
            score += 0.35
            reasons.append("person B on ground, A standing")

        # --- raised arms (striking motion) ---
        arms_raised_a = feat_a["left_arm_raised"] or feat_a["right_arm_raised"]
        arms_raised_b = feat_b["left_arm_raised"] or feat_b["right_arm_raised"]

        if arms_raised_a and arms_raised_b:
            score += 0.15
            reasons.append("both have raised arms")
        elif arms_raised_a or arms_raised_b:
            score += 0.1
            reasons.append("one person has raised arms")

        # --- rapid movement (approach velocity) ---
        vel_a = tracker.get_velocity(id_a)
        vel_b = tracker.get_velocity(id_b)

        if vel_a > 30 or vel_b > 30:  # fast movement in pixels/frame
            score += 0.15
            reasons.append(f"rapid movement (vel: {vel_a:.0f}, {vel_b:.0f})")

        # --- closing distance (getting closer over time) ---
        track_a = tracker.tracks[id_a]
        track_b = tracker.tracks[id_b]

        if len(track_a) > 10 and len(track_b) > 10:
            old_dist = np.sqrt(
                (track_a[-10]["centroid"][0] - track_b[-10]["centroid"][0]) ** 2 +
                (track_a[-10]["centroid"][1] - track_b[-10]["centroid"][1]) ** 2
            )
            if old_dist > distance + 50:
                score += 0.1
                reasons.append("closing distance rapidly")

        return min(score, 1.0), reasons

    def score_solo(self, person_id, features, tracker):
        """score a lone person — possible medical emergency"""

        score = 0.0
        reasons = []

        if features is None:
            return 0.0, []

        if features["is_horizontal"]:
            score += 0.3
            reasons.append("person is horizontal/on ground")

            # if they've been down for a while
            track = tracker.tracks[person_id]
            if len(track) > 15:
                recent_velocities = [
                    np.sqrt(
                        (track[i]["centroid"][0] - track[i - 1]["centroid"][0]) ** 2 +
                        (track[i]["centroid"][1] - track[i - 1]["centroid"][1]) ** 2
                    )
                    for i in range(-15, 0)
                ]
                if max(recent_velocities) < 5:
                    score += 0.3
                    reasons.append("motionless on ground for extended period")

        return min(score, 1.0), reasons