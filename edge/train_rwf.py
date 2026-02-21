"""Offline training script for the threat classifier on the RWF-2000 dataset.

Usage:
    python train_rwf.py /path/to/RWF-2000
    python train_rwf.py /path/to/RWF-2000 --features-cache features_rwf.npz
    python train_rwf.py /path/to/RWF-2000 --features-cache features_rwf.npz --n-estimators 300
    python train_rwf.py /path/to/RWF-2000 --max-clips 10
"""
import argparse
import os
import pickle
import time

import cv2
import mediapipe as mp_lib
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
from itertools import combinations
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import classification_report, roc_auc_score
from ultralytics import YOLO

from main import PersonTracker, ThreatScorer, extract_pose_features, MODEL_PATH
from classifier import build_pair_feature_vector, FEATURE_NAMES


# ============================================================
# CLI
# ============================================================

def parse_args():
    p = argparse.ArgumentParser(description="Train threat classifier on RWF-2000")
    p.add_argument("dataset", help="Path to RWF-2000 root (contains train/ and val/)")
    p.add_argument("--sample-rate", type=int, default=3,
                   help="Collect feature vectors every N frames (default: 3)")
    p.add_argument("--output", default="models/threat_classifier.pkl",
                   help="Output model path (default: models/threat_classifier.pkl)")
    p.add_argument("--features-cache",
                   help="Path to .npz file for saving/loading extracted features")
    p.add_argument("--n-estimators", type=int, default=200)
    p.add_argument("--max-depth", type=int, default=4)
    p.add_argument("--learning-rate", type=float, default=0.05)
    p.add_argument("--max-clips", type=int, default=None,
                   help="Limit clips per split (for quick testing)")
    return p.parse_args()


# ============================================================
# MODEL INIT
# ============================================================

def init_models():
    yolo = YOLO("yolov8n.pt")
    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(base_options=base_options, num_poses=1)
    landmarker = vision.PoseLandmarker.create_from_options(options)
    return yolo, landmarker


# ============================================================
# PER-CLIP PIPELINE
# ============================================================

def process_clip(path, label, yolo, landmarker, sample_rate):
    """Process a single video clip, replicating main.py's per-frame pipeline.

    Processes ALL frames to maintain velocity/acceleration continuity,
    but only collects feature vectors every sample_rate frames.

    Returns list of (26-dim feature_vector, label) tuples.
    """
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        print(f"  WARNING: cannot open {path}")
        return []

    tracker = PersonTracker()
    scorer = ThreatScorer()
    samples = []
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        scorer.frame_count += 1

        # 1. YOLO person detection
        results = yolo(frame, classes=[0], conf=0.5, verbose=False)
        people = []

        for box in results[0].boxes:
            bbox = list(map(int, box.xyxy[0]))
            x1, y1, x2, y2 = bbox

            person_crop = frame[y1:y2, x1:x2]
            if person_crop.size == 0:
                continue

            # 2. MediaPipe pose estimation
            rgb_crop = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
            mp_image = mp_lib.Image(image_format=mp_lib.ImageFormat.SRGB, data=rgb_crop)
            pose_results = landmarker.detect(mp_image)

            landmarks = None
            features = None

            if pose_results.pose_landmarks:
                landmarks = pose_results.pose_landmarks[0]
                features = extract_pose_features(landmarks)

            # 3. Track
            person_id = tracker.get_person_id(bbox)
            tracker.update(person_id, bbox, landmarks)
            people.append((person_id, features, bbox))

        # 4. Score all pairs (every frame for state continuity)
        is_sample_frame = (frame_idx % sample_rate == 0)

        for a, b in combinations(people, 2):
            scorer.score_pair(a, b, tracker)

            # 5. Collect feature vectors on sample frames only
            if is_sample_frame and scorer.last_pair_data is not None:
                _, feat_a, bbox_a = a
                _, feat_b, bbox_b = b
                if feat_a is not None and feat_b is not None:
                    d = scorer.last_pair_data
                    fv = build_pair_feature_vector(
                        feat_a, feat_b, bbox_a, bbox_b,
                        d["arm_a"], d["arm_b"], d["vel_a"], d["vel_b"],
                        d["closing_rate"],
                    )
                    samples.append((fv, label))

        frame_idx += 1

    cap.release()
    return samples


# ============================================================
# DATASET EXTRACTION
# ============================================================

def extract_dataset(root, yolo, landmarker, sample_rate, max_clips):
    """Walk {train,val}/{Fight,NonFight}/*.avi and extract feature vectors.

    Returns (train_X, train_y), (val_X, val_y) as numpy arrays.
    """
    splits = {}
    for split in ("train", "val"):
        all_samples = []
        clip_count = 0

        for class_name, label in [("Fight", 1), ("NonFight", 0)]:
            class_dir = os.path.join(root, split, class_name)
            if not os.path.isdir(class_dir):
                print(f"WARNING: {class_dir} not found, skipping")
                continue

            clip_files = sorted([
                f for f in os.listdir(class_dir)
                if f.lower().endswith((".avi", ".mp4"))
            ])

            class_count = 0
            for i, fname in enumerate(clip_files):
                if max_clips is not None and class_count >= max_clips:
                    break

                clip_path = os.path.join(class_dir, fname)
                t0 = time.time()
                clip_samples = process_clip(clip_path, label, yolo, landmarker, sample_rate)
                elapsed = time.time() - t0
                all_samples.extend(clip_samples)
                clip_count += 1
                class_count += 1

                if clip_count % 10 == 0 or clip_count <= 3:
                    print(f"  [{split}] {clip_count} clips | "
                          f"{len(all_samples)} samples | "
                          f"last clip: {len(clip_samples)} FVs in {elapsed:.1f}s | "
                          f"{fname}")

        if all_samples:
            X = np.array([s[0] for s in all_samples])
            y = np.array([s[1] for s in all_samples])
        else:
            X = np.empty((0, 26))
            y = np.empty(0, dtype=int)

        splits[split] = (X, y)
        print(f"  [{split}] DONE — {len(y)} samples "
              f"({np.sum(y == 1)} fight, {np.sum(y == 0)} non-fight)")

    return splits["train"], splits["val"]


# ============================================================
# FEATURE CACHE
# ============================================================

def save_features(path, train_X, train_y, val_X, val_y):
    np.savez_compressed(path,
                        train_X=train_X, train_y=train_y,
                        val_X=val_X, val_y=val_y)
    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"Saved feature cache to {path} ({size_mb:.1f} MB)")


def load_features(path):
    data = np.load(path)
    print(f"Loaded feature cache from {path}")
    return (data["train_X"], data["train_y"]), (data["val_X"], data["val_y"])


# ============================================================
# TRAINING
# ============================================================

def train_and_evaluate(train_X, train_y, val_X, val_y, args):
    print(f"\nTraining GBM: {len(train_y)} train samples, {len(val_y)} val samples")
    print(f"  n_estimators={args.n_estimators}, max_depth={args.max_depth}, "
          f"lr={args.learning_rate}")

    model = GradientBoostingClassifier(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        learning_rate=args.learning_rate,
        subsample=0.8,
        min_samples_leaf=10,
        n_iter_no_change=20,
        validation_fraction=0.1,
        random_state=42,
    )
    model.fit(train_X, train_y)

    # Evaluate on validation set
    val_pred = model.predict(val_X)
    val_proba = model.predict_proba(val_X)[:, 1]

    print(f"\n{'='*60}")
    print("Validation Results")
    print(f"{'='*60}")
    print(classification_report(val_y, val_pred, target_names=["NonFight", "Fight"]))

    auc = roc_auc_score(val_y, val_proba)
    print(f"ROC AUC: {auc:.4f}")

    # Feature importances
    importances = model.feature_importances_
    indices = np.argsort(importances)[::-1]
    print(f"\nTop 10 features:")
    for rank, idx in enumerate(indices[:10]):
        print(f"  {rank+1}. {FEATURE_NAMES[idx]:25s} {importances[idx]:.4f}")

    return model


# ============================================================
# MAIN
# ============================================================

def main():
    args = parse_args()

    # Validate dataset directory
    for split in ("train", "val"):
        split_dir = os.path.join(args.dataset, split)
        if not os.path.isdir(split_dir):
            print(f"ERROR: {split_dir} not found. Expected RWF-2000 layout:")
            print(f"  {args.dataset}/train/Fight/")
            print(f"  {args.dataset}/train/NonFight/")
            print(f"  {args.dataset}/val/Fight/")
            print(f"  {args.dataset}/val/NonFight/")
            return

    # Extract or load features
    if args.features_cache and os.path.exists(args.features_cache):
        (train_X, train_y), (val_X, val_y) = load_features(args.features_cache)
    else:
        print("Initializing YOLO + MediaPipe...")
        yolo, landmarker = init_models()

        print(f"\nExtracting features (sample_rate={args.sample_rate}"
              f"{f', max_clips={args.max_clips}' if args.max_clips else ''})...")
        (train_X, train_y), (val_X, val_y) = extract_dataset(
            args.dataset, yolo, landmarker, args.sample_rate, args.max_clips)

        if args.features_cache:
            save_features(args.features_cache, train_X, train_y, val_X, val_y)

    if len(train_y) == 0:
        print("ERROR: no training samples extracted")
        return
    if len(set(train_y)) < 2:
        print("ERROR: need samples from both classes")
        return

    # Train
    model = train_and_evaluate(train_X, train_y, val_X, val_y, args)

    # Save in ThreatClassifier-compatible format
    training_data = list(zip(
        [train_X[i] for i in range(len(train_X))],
        [int(train_y[i]) for i in range(len(train_y))],
    ))

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "wb") as f:
        pickle.dump({"model": model, "training_data": training_data}, f)
    print(f"\nModel saved to {args.output}")
    print(f"Copy to edge device and run main.py — should show 'Mode: ML'")


if __name__ == "__main__":
    main()
