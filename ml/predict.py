"""Small command-line predictor for inspecting the exported MVP model."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from .features import BehaviorEvidence, extract_features


MODEL_PATH = Path(__file__).resolve().parents[1] / "app" / "lib" / "generated-model.json"


def predict_probability(features: list[float], model_path: Path = MODEL_PATH) -> float:
    artifact = json.loads(model_path.read_text(encoding="utf-8"))
    standardized = [
        (value - mean) / scale
        for value, mean, scale in zip(
            features,
            artifact["scaler_mean"],
            artifact["scaler_scale"],
            strict=True,
        )
    ]
    logit = artifact["intercept"] + sum(
        weight * value
        for weight, value in zip(artifact["coefficients"], standardized, strict=True)
    )
    return 1.0 / (1.0 + math.exp(-logit))


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect a local CodeProof AI prediction")
    parser.add_argument("--text", required=True)
    parser.add_argument("--kind", choices=["code", "explanation"], default="explanation")
    parser.add_argument("--typed", type=int, default=0)
    parser.add_argument("--pasted", type=int, default=0)
    parser.add_argument("--large-insertions", type=int, default=0)
    parser.add_argument("--deletions", type=int, default=0)
    parser.add_argument("--corrections", type=int, default=0)
    parser.add_argument("--active-ms", type=int, default=0)
    args = parser.parse_args()
    evidence = BehaviorEvidence(
        typed_characters=args.typed,
        pasted_characters=args.pasted,
        large_insertions=args.large_insertions,
        deletions=args.deletions,
        corrections=args.corrections,
        active_time_ms=args.active_ms,
    )
    probability = predict_probability(extract_features(args.text, evidence, args.kind))
    print(json.dumps({"ai_style_probability": round(probability, 4)}, indent=2))


if __name__ == "__main__":
    main()
