import os
import pickle

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier


FEATURE_NAMES = [
    "normalized_distance",
    "torso_angle_a", "torso_angle_b",
    "is_horizontal_a", "is_horizontal_b",
    "left_arm_elev_a", "right_arm_elev_a", "left_arm_elev_b", "right_arm_elev_b",
    "left_arm_raised_a", "right_arm_raised_a", "left_arm_raised_b", "right_arm_raised_b",
    "raw_vel_a", "raw_vel_b",
    "directed_vel_a", "directed_vel_b",
    "lateral_vel_a", "lateral_vel_b",
    "acceleration_a", "acceleration_b",
    "directionality_a", "directionality_b",
    "body_vel_a", "body_vel_b",
    "closing_rate",
]


def build_pair_feature_vector(feat_a, feat_b, bbox_a, bbox_b,
                              dir_vel_a, dir_vel_b, vel_a, vel_b,
                              closing_rate):
    """Convert per-frame pose/velocity data into a fixed-size feature vector.

    Parameters
    ----------
    feat_a, feat_b : dict
        Dicts from extract_pose_features() (main.py:89).
    bbox_a, bbox_b : list
        [x1, y1, x2, y2] pixel coordinates.
    dir_vel_a, dir_vel_b : dict
        Dicts from get_directional_arm_velocity() with keys:
        directed_vel, lateral_vel, acceleration, raw_vel.
    vel_a, vel_b : float
        Body centroid velocity (px/frame).
    closing_rate : float
        Rate at which the two people are closing distance.

    Returns
    -------
    np.ndarray of shape (26,)
        Feature vector in FEATURE_NAMES order.
    """
    # normalized distance: pixel distance between bbox centroids / avg bbox width
    cx_a = (bbox_a[0] + bbox_a[2]) / 2
    cy_a = (bbox_a[1] + bbox_a[3]) / 2
    cx_b = (bbox_b[0] + bbox_b[2]) / 2
    cy_b = (bbox_b[1] + bbox_b[3]) / 2
    pixel_dist = np.sqrt((cx_a - cx_b) ** 2 + (cy_a - cy_b) ** 2)
    avg_width = ((bbox_a[2] - bbox_a[0]) + (bbox_b[2] - bbox_b[0])) / 2
    normalized_distance = pixel_dist / (avg_width + 1e-6)

    # directionality: fraction of arm motion aimed at target
    directionality_a = dir_vel_a["directed_vel"] / (dir_vel_a["raw_vel"] + 1e-6)
    directionality_b = dir_vel_b["directed_vel"] / (dir_vel_b["raw_vel"] + 1e-6)

    return np.array([
        normalized_distance,
        feat_a["torso_angle"],
        feat_b["torso_angle"],
        float(feat_a["is_horizontal"]),
        float(feat_b["is_horizontal"]),
        feat_a["left_arm_elevation"],
        feat_a["right_arm_elevation"],
        feat_b["left_arm_elevation"],
        feat_b["right_arm_elevation"],
        float(feat_a["left_arm_raised"]),
        float(feat_a["right_arm_raised"]),
        float(feat_b["left_arm_raised"]),
        float(feat_b["right_arm_raised"]),
        dir_vel_a["raw_vel"],
        dir_vel_b["raw_vel"],
        dir_vel_a["directed_vel"],
        dir_vel_b["directed_vel"],
        dir_vel_a["lateral_vel"],
        dir_vel_b["lateral_vel"],
        dir_vel_a["acceleration"],
        dir_vel_b["acceleration"],
        directionality_a,
        directionality_b,
        vel_a,
        vel_b,
        closing_rate,
    ], dtype=np.float64)


class ThreatClassifier:

    def __init__(self, model_path="models/threat_classifier.pkl"):
        self.model_path = model_path
        self.min_samples_to_train = 10

        if os.path.exists(model_path):
            with open(model_path, "rb") as f:
                data = pickle.load(f)
            self.model = data["model"]
            self.training_data = data["training_data"]
        else:
            self.model = None
            self.training_data = []

    def predict(self, feature_vector):
        if self.model is None:
            return None
        proba = self.model.predict_proba(feature_vector.reshape(1, -1))
        return float(proba[0, 1])

    def add_sample(self, feature_vector, label):
        self.training_data.append((feature_vector, label))
        print(f"[ThreatClassifier] {len(self.training_data)} samples collected")

    def retrain(self):
        if len(self.training_data) < self.min_samples_to_train:
            print(f"[ThreatClassifier] Need at least {self.min_samples_to_train} samples "
                  f"to train (have {len(self.training_data)})")
            return False

        X = np.array([s[0] for s in self.training_data])
        y = np.array([s[1] for s in self.training_data])

        if len(set(y)) < 2:
            print("[ThreatClassifier] Need samples from both classes to train")
            return False

        self.model = GradientBoostingClassifier(
            n_estimators=50, max_depth=3, learning_rate=0.1,
        )
        self.model.fit(X, y)

        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump({"model": self.model, "training_data": self.training_data}, f)

        print(f"[ThreatClassifier] Trained on {len(self.training_data)} samples, saved to {self.model_path}")
        return True
