"""Feature extraction shared by the training pipeline and Python tests.

The model estimates an AI-style probability from content style plus in-editor
behavior. It is intentionally supporting evidence, not an authorship detector.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


FEATURE_NAMES = [
    "paste_ratio",
    "large_insertion_rate",
    "edit_ratio",
    "active_seconds_per_100_chars",
    "lexical_polish",
    "genericity",
    "too_fast",
    "is_explanation",
]


@dataclass(frozen=True)
class BehaviorEvidence:
    typed_characters: int = 0
    pasted_characters: int = 0
    large_insertions: int = 0
    deletions: int = 0
    corrections: int = 0
    active_time_ms: int = 0


POLISHED_TERMS = re.compile(
    r"\b(furthermore|moreover|therefore|robust|leverages|utilizes|"
    r"comprehensive|scalable|seamless|optimal)\b",
    re.IGNORECASE,
)
GENERIC_PHRASES = re.compile(
    r"processes the data|efficient and robust|various edge cases|"
    r"handles the input|returns the result",
    re.IGNORECASE,
)


def extract_features(
    text: str,
    behavior: BehaviorEvidence,
    content_kind: str,
) -> list[float]:
    """Return the eight bounded numeric features expected by the model."""

    total_chars = max(1, behavior.typed_characters + behavior.pasted_characters)
    paste_ratio = min(1.0, behavior.pasted_characters / total_chars)
    large_insertion_rate = min(1.0, behavior.large_insertions / 2.0)
    edit_ratio = min(
        1.0,
        (behavior.deletions + behavior.corrections * 2) / total_chars,
    )
    active_seconds_per_100_chars = min(
        2.0,
        (behavior.active_time_ms / 1000.0) / (total_chars / 100.0),
    )
    polished_count = len(POLISHED_TERMS.findall(text))
    lexical_polish = min(1.0, polished_count / 3.0)
    genericity = 1.0 if GENERIC_PHRASES.search(text) else 0.0
    word_count = len(text.split())
    too_fast = 1.0 if word_count > 35 and behavior.active_time_ms < 12_000 else 0.0
    is_explanation = 1.0 if content_kind == "explanation" else 0.0
    return [
        paste_ratio,
        large_insertion_rate,
        edit_ratio,
        active_seconds_per_100_chars,
        lexical_polish,
        genericity,
        too_fast,
        is_explanation,
    ]
