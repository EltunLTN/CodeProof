"""Train and export the small local CodeProof AI style model.

The dataset is generated deterministically from transparent learner-behavior
archetypes so the MVP can be reproduced without downloading private data.
The exported logistic regression is consumed directly by the web app.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

try:
    from .features import FEATURE_NAMES
except ImportError:
    from features import FEATURE_NAMES


RANDOM_SEED = 42
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "app" / "lib" / "generated-model.json"


def generate_training_data(samples: int = 1600, seed: int = RANDOM_SEED):
    """Create labeled, reproducible behavior/style samples for the demo model."""

    rng = np.random.default_rng(seed)
    labels = rng.integers(0, 2, size=samples)
    kinds = rng.integers(0, 2, size=samples)
    rows: list[list[float]] = []

    for label, is_explanation in zip(labels, kinds, strict=True):
        if label == 0:
            paste_ratio = rng.beta(1.3, 6.5)
            large_insertions = rng.beta(1.0, 7.0)
            edit_ratio = min(1.0, rng.beta(2.5, 8.0))
            active_rate = min(2.0, rng.normal(0.82, 0.28))
            polish = rng.beta(1.2, 5.0)
            genericity = float(rng.random() < 0.08)
            too_fast = float(rng.random() < 0.05)
        else:
            paste_ratio = rng.beta(5.5, 1.6)
            large_insertions = rng.beta(4.0, 1.8)
            edit_ratio = rng.beta(1.0, 11.0)
            active_rate = max(0.01, rng.normal(0.13, 0.10))
            polish = rng.beta(3.4, 2.1) if is_explanation else rng.beta(1.7, 3.2)
            genericity = float(rng.random() < (0.43 if is_explanation else 0.10))
            too_fast = float(rng.random() < 0.55)

        # Add overlap so probability stays calibrated and is never treated as proof.
        if rng.random() < 0.16:
            paste_ratio = rng.uniform(0.25, 0.72)
            edit_ratio = rng.uniform(0.04, 0.22)
            active_rate = rng.uniform(0.18, 0.72)

        rows.append([
            float(np.clip(paste_ratio, 0, 1)),
            float(np.clip(large_insertions, 0, 1)),
            float(np.clip(edit_ratio, 0, 1)),
            float(np.clip(active_rate, 0, 2)),
            float(np.clip(polish, 0, 1)),
            genericity,
            too_fast,
            float(is_explanation),
        ])

    return np.asarray(rows, dtype=float), labels.astype(int)


def train(samples: int = 1600, seed: int = RANDOM_SEED) -> dict:
    x, y = generate_training_data(samples=samples, seed=seed)
    x_train, x_test, y_train, y_test = train_test_split(
        x, y, test_size=0.25, random_state=seed, stratify=y
    )
    scaler = StandardScaler().fit(x_train)
    model = LogisticRegression(
        random_state=seed,
        class_weight="balanced",
        max_iter=1000,
        C=0.72,
    ).fit(scaler.transform(x_train), y_train)
    probabilities = model.predict_proba(scaler.transform(x_test))[:, 1]
    predictions = (probabilities >= 0.5).astype(int)
    return {
        "version": 1,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Local supporting estimate of AI-style probability; not proof of authorship.",
        "model_type": "standardized_logistic_regression",
        "feature_names": FEATURE_NAMES,
        "scaler_mean": scaler.mean_.round(10).tolist(),
        "scaler_scale": scaler.scale_.round(10).tolist(),
        "coefficients": model.coef_[0].round(10).tolist(),
        "intercept": float(round(model.intercept_[0], 10)),
        "threshold": 0.5,
        "training_samples": int(samples),
        "random_seed": int(seed),
        "validation": {
            "samples": int(len(y_test)),
            "accuracy": float(round(accuracy_score(y_test, predictions), 4)),
            "roc_auc": float(round(roc_auc_score(y_test, probabilities), 4)),
            "log_loss": float(round(log_loss(y_test, probabilities), 4)),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the CodeProof AI local style model")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--samples", type=int, default=1600)
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    args = parser.parse_args()
    artifact = train(samples=args.samples, seed=args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    metrics = artifact["validation"]
    print(f"Model written to {args.output}")
    print(
        f"Validation: accuracy={metrics['accuracy']:.3f}, "
        f"ROC-AUC={metrics['roc_auc']:.3f}, log-loss={metrics['log_loss']:.3f}"
    )


if __name__ == "__main__":
    main()
