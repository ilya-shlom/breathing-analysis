#!/usr/bin/env python3
"""
ie_classifier.py
====================

Train or use a model that labels a breath—sound fragment as INHALE (0) or EXHALE (1).

Dataset layout for training
---------------------------
dataset/
 ├── inhale/
 │    ├── 0001.wav
 │    ├── ...
 └── exhale/
      ├── 0001.wav
      ├── ...

Each file should be a mono 1—kHz WAV of about 1—3s.

Usage
-----
# Train and save model
python ie_classifier.py train ./dataset model.joblib

# Predict on a single clip
python ie_classifier.py predict model.joblib ./clip.wav

# Record 3s from microphone and classify (needs sounddevice)
python ie_classifier.py record model.joblib 3
"""

import argparse
import json
import os
import sys
from pathlib import Path
import soundfile as sf        #  add this


import joblib
import librosa
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix


SR = 16_000               # Target sampling rate
WIN_LENGTH = 0.025        # 25 ms windows
HOP_LENGTH = 0.010        # 10 ms hop
N_MFCC = 20               # Number of MFCC coefficients used


def extract_features(wav_path: str) -> np.ndarray:
    """Load a WAV file and return time—averaged MFCC and delta features."""
    y, sr = librosa.load(wav_path, sr=SR, mono=True)
    # Pad / trim to at least 0.5 s so very short clips still work
    if len(y) < 0.5 * SR:
        y = np.pad(y, (0, int(0.5 * SR) - len(y)))
    mfcc = librosa.feature.mfcc(
        y=y,
        sr=sr,
        n_mfcc=N_MFCC,
        hop_length=int(HOP_LENGTH * sr),
        n_fft=int(WIN_LENGTH * sr),
    )
    delta = librosa.feature.delta(mfcc)
    feat = np.concatenate([mfcc, delta], axis=0)
    # Average over time frames → shape (2 × N_MFCC,)
    return feat.mean(axis=1)


def build_dataset(root: Path):
    """Scan dataset directory and return (X, y, file_paths)."""
    X, y, files = [], [], []
    for label_name, label_id in (("inhale", 0), ("exhale", 1)):
        class_dir = root / label_name
        for wav in class_dir.glob("*.wav"):
            X.append(extract_features(str(wav)))
            y.append(label_id)
            files.append(str(wav))
    X, y = np.vstack(X), np.array(y)
    return X, y, files


def train(args):
    root = Path(args.data_dir)
    print(f"[INFO] Building dataset from {root.resolve()}")
    X, y, files = build_dataset(root)
    print(f"[INFO] Samples: {len(y)}, inhale: {(y==0).sum()}, exhale: {(y==1).sum()}")

    # ML pipeline: z‑score → logistic regression
    clf = Pipeline(
        [
            ("scale", StandardScaler()),
            ("lr", LogisticRegression(max_iter=1000, C=1.0)),
        ]
    )
    clf.fit(X, y)

    # Quick report (train‑set – for demo; use CV for real training)
    y_pred = clf.predict(X)
    print("[TRAIN—SET REPORT]\n", classification_report(y, y_pred))

    joblib.dump(clf, args.model_path)
    print(f"[OK] Model saved to {args.model_path}")


def predict(args):
    clf = joblib.load(args.model_path)
    feat = extract_features(args.wav_path)
    prob = clf.predict_proba(feat.reshape(1, -1))[0]
    label = "inhale" if prob[0] > prob[1] else "exhale"
    print(json.dumps({"label": label, "probabilities": {"inhale": prob[0], "exhale": prob[1]}}))


def record_and_predict(args):
    try:
        import sounddevice as sd
    except ImportError:
        sys.exit("sounddevice not installed. Run `pip install sounddevice` or skip record mode.")

    clf = joblib.load(args.model_path)
    duration = float(args.seconds)

    print(f"[INFO] Recording {duration:.1f}s of audio …")
    audio = sd.rec(int(duration * SR), samplerate=SR, channels=1, dtype="float32")
    sd.wait()
    y = audio.flatten()

    # ▸ Option A – keep the logic unchanged, just use SoundFile
    tmp = "temp_clip.wav"
    sf.write(tmp, y, SR)              # ← replaces librosa.output.write_wav
    feat = extract_features(tmp)
    os.remove(tmp)

    # ▸ Option B – (no temp file) feed the raw signal
    # feat = extract_features_from_array(y)  # need a tiny helper; see below

    prob = clf.predict_proba(feat.reshape(1, -1))[0]
    label = "inhale" if prob[0] > prob[1] else "exhale"
    print(
        json.dumps(
            {
                "label": label,
                "probabilities": {"inhale": float(prob[0]), "exhale": float(prob[1])},
            }
        )
    )


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="mode", required=True)

    train_p = sub.add_parser("train", help="Train model")
    train_p.add_argument("data_dir", help="Folder with inhale/ and exhale/ WAVs")
    train_p.add_argument("model_path", help="Output .joblib path")

    pred_p = sub.add_parser("predict", help="Predict label of a clip")
    pred_p.add_argument("model_path", help=".joblib model file")
    pred_p.add_argument("wav_path", help="Path to WAV to classify")

    rec_p = sub.add_parser("record", help="Record from mic and classify")
    rec_p.add_argument("model_path", help=".joblib model file")
    rec_p.add_argument("seconds", help="Seconds to record (e.g. 3)")

    args = p.parse_args()

    if args.mode == "train":
        train(args)
    elif args.mode == "predict":
        predict(args)
    elif args.mode == "record":
        record_and_predict(args)
    else:
        p.print_help()


if __name__ == "__main__":
    main()
