import unittest
from pathlib import Path

from ml.features import BehaviorEvidence, FEATURE_NAMES, extract_features
from ml.predict import predict_probability
from ml.train_model import generate_training_data, train


class ModelTests(unittest.TestCase):
    def test_feature_contract_is_stable(self):
        features = extract_features(
            "This explanation processes the data efficiently and robustly.",
            BehaviorEvidence(pasted_characters=60, large_insertions=1, active_time_ms=2_000),
            "explanation",
        )
        self.assertEqual(len(features), len(FEATURE_NAMES))
        self.assertEqual(len(FEATURE_NAMES), 8)
        self.assertTrue(all(0 <= value <= 2 for value in features))

    def test_training_is_reproducible(self):
        x1, y1 = generate_training_data(samples=80, seed=7)
        x2, y2 = generate_training_data(samples=80, seed=7)
        self.assertTrue((x1 == x2).all())
        self.assertTrue((y1 == y2).all())

    def test_trained_model_has_expected_artifact_fields(self):
        artifact = train(samples=300, seed=11)
        self.assertEqual(artifact["model_type"], "standardized_logistic_regression")
        self.assertEqual(len(artifact["coefficients"]), len(FEATURE_NAMES))
        self.assertTrue(0 <= artifact["validation"]["accuracy"] <= 1)
        self.assertTrue(0 <= artifact["validation"]["roc_auc"] <= 1)

    def test_gradual_work_is_lower_probability_than_instant_paste(self):
        model_path = Path(__file__).parents[1] / "app" / "lib" / "generated-model.json"
        text = "The total variable stores sum(numbers), then the function divides by len(numbers)."
        gradual = extract_features(
            text,
            BehaviorEvidence(typed_characters=150, deletions=20, corrections=5, active_time_ms=120_000),
            "explanation",
        )
        pasted = extract_features(
            text,
            BehaviorEvidence(pasted_characters=150, large_insertions=1, active_time_ms=2_000),
            "explanation",
        )
        self.assertLess(
            predict_probability(gradual, model_path),
            predict_probability(pasted, model_path),
        )


if __name__ == "__main__":
    unittest.main()
