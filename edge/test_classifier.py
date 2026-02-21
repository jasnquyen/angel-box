"""Sanity-check for ThreatClassifier: train on synthetic data, verify predictions."""

import os
import numpy as np
from classifier import build_pair_feature_vector, ThreatClassifier, FEATURE_NAMES

TEST_MODEL_PATH = "/tmp/test_threat_classifier.pkl"

# Clean slate
if os.path.exists(TEST_MODEL_PATH):
    os.remove(TEST_MODEL_PATH)

rng = np.random.default_rng(42)


def make_safe_vector():
    """Low velocities, far apart, nobody on the ground."""
    return np.array([
        rng.uniform(2.0, 4.0),       # normalized_distance
        rng.uniform(4.0, 8.0),       # torso_angle_a  (upright)
        rng.uniform(4.0, 8.0),       # torso_angle_b
        0.0,                         # is_horizontal_a
        0.0,                         # is_horizontal_b
        rng.uniform(0.0, 0.02),      # left_arm_elev_a
        rng.uniform(0.0, 0.02),      # right_arm_elev_a
        rng.uniform(0.0, 0.02),      # left_arm_elev_b
        rng.uniform(0.0, 0.02),      # right_arm_elev_b
        0.0,                         # left_arm_raised_a
        0.0,                         # right_arm_raised_a
        0.0,                         # left_arm_raised_b
        0.0,                         # right_arm_raised_b
        rng.uniform(0.01, 0.05),     # raw_vel_a
        rng.uniform(0.01, 0.05),     # raw_vel_b
        rng.uniform(0.0, 0.02),      # directed_vel_a
        rng.uniform(0.0, 0.02),      # directed_vel_b
        rng.uniform(0.01, 0.04),     # lateral_vel_a
        rng.uniform(0.01, 0.04),     # lateral_vel_b
        rng.uniform(-0.01, 0.01),    # acceleration_a
        rng.uniform(-0.01, 0.01),    # acceleration_b
        rng.uniform(0.0, 0.3),       # directionality_a
        rng.uniform(0.0, 0.3),       # directionality_b
        rng.uniform(1.0, 5.0),       # body_vel_a
        rng.uniform(1.0, 5.0),       # body_vel_b
        rng.uniform(-5.0, 5.0),      # closing_rate
    ], dtype=np.float64)


def make_threat_vector(horizontal=False):
    """High velocities, close together, optionally someone on the ground."""
    return np.array([
        rng.uniform(0.5, 1.5),       # normalized_distance
        rng.uniform(0.5, 2.0) if horizontal else rng.uniform(4.0, 8.0),  # torso_angle_a
        rng.uniform(4.0, 8.0),       # torso_angle_b
        1.0 if horizontal else 0.0,  # is_horizontal_a
        0.0,                         # is_horizontal_b
        rng.uniform(0.1, 0.3),       # left_arm_elev_a
        rng.uniform(0.1, 0.3),       # right_arm_elev_a
        rng.uniform(0.05, 0.2),      # left_arm_elev_b
        rng.uniform(0.05, 0.2),      # right_arm_elev_b
        1.0,                         # left_arm_raised_a
        1.0,                         # right_arm_raised_a
        0.0,                         # left_arm_raised_b
        1.0,                         # right_arm_raised_b
        rng.uniform(0.15, 0.40),     # raw_vel_a
        rng.uniform(0.15, 0.40),     # raw_vel_b
        rng.uniform(0.10, 0.35),     # directed_vel_a
        rng.uniform(0.10, 0.35),     # directed_vel_b
        rng.uniform(0.02, 0.10),     # lateral_vel_a
        rng.uniform(0.02, 0.10),     # lateral_vel_b
        rng.uniform(0.05, 0.20),     # acceleration_a
        rng.uniform(0.05, 0.20),     # acceleration_b
        rng.uniform(0.6, 0.95),      # directionality_a
        rng.uniform(0.6, 0.95),      # directionality_b
        rng.uniform(15.0, 30.0),     # body_vel_a
        rng.uniform(15.0, 30.0),     # body_vel_b
        rng.uniform(20.0, 60.0),     # closing_rate
    ], dtype=np.float64)


# ---- build training set ----
clf = ThreatClassifier(model_path=TEST_MODEL_PATH)

for _ in range(15):
    clf.add_sample(make_safe_vector(), 0)

for i in range(15):
    clf.add_sample(make_threat_vector(horizontal=(i < 5)), 1)

print(f"\nTotal samples: {len(clf.training_data)}")

# ---- train ----
ok = clf.retrain()
assert ok, "retrain() should have succeeded"

# ---- predict on test vectors ----
print("\n--- Predictions on test vectors ---")

safe_test = make_safe_vector()
threat_test = make_threat_vector(horizontal=True)

safe_score = clf.predict(safe_test)
threat_score = clf.predict(threat_test)

print(f"Safe vector   -> {safe_score:.4f}")
print(f"Threat vector -> {threat_score:.4f}")

assert safe_score < 0.3, f"Safe vector scored too high: {safe_score:.4f}"
assert threat_score > 0.7, f"Threat vector scored too low: {threat_score:.4f}"

# a few more for good measure
print("\nBatch predictions:")
for i in range(3):
    s = clf.predict(make_safe_vector())
    t = clf.predict(make_threat_vector(horizontal=(i == 0)))
    print(f"  safe={s:.4f}  threat={t:.4f}")

# ---- verify build_pair_feature_vector still imports ----
assert len(FEATURE_NAMES) == 26
print(f"\nFEATURE_NAMES ok ({len(FEATURE_NAMES)} features)")

# cleanup
os.remove(TEST_MODEL_PATH)
print("\nAll checks passed.")
