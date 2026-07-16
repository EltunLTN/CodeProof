# CodeProof AI local style model — MVP model card

## Purpose

This small logistic-regression model estimates whether submitted code or explanation text resembles selected AI-assisted style and editing patterns. It is a supporting signal in a learner-understanding assessment. It is not an AI detector, plagiarism detector, identity system, or proof of authorship.

## Model and data

- Model: standardized logistic regression (`scikit-learn`)
- Artifact: `app/lib/generated-model.json`
- Training script: `ml/train_model.py`
- Data: 1,600 deterministic synthetic samples generated from transparent gradual-writing, mixed-editing, and instant-paste archetypes
- Seed: 42
- Features: paste ratio, large insertion rate, edit ratio, active time per 100 characters, polished lexical markers, generic phrases, unusually fast completion, and content type

The generated artifact records its held-out accuracy, ROC-AUC, and log loss. These metrics describe separation within the synthetic MVP data only; they do not establish real-world detection accuracy.

## Intended use

Use the probability only to support a broader evidence review. A learner who pasted code can still earn a high score by explaining, predicting, handling edge cases, and modifying the program correctly. Interactive verification is weighted much more heavily than this probability.

## Limitations

- Synthetic training data cannot represent every learner, tool, disability, language background, or editing workflow.
- Paste and speed patterns have many benign explanations.
- Polished language is not evidence of AI use.
- Code style differs greatly by language, classroom, and assignment.
- Probabilities are pattern similarity estimates, not calibrated authorship probabilities for a real population.

## Safety and fairness rules

- Never label work “definitely AI-generated.”
- Never fail, discipline, or accuse a learner based on the model.
- Present the note: **AI-style probability is supporting evidence, not proof.**
- Prefer direct, code-specific verification evidence over behavioral inference.
- Keep all model inputs and results on the local device.

## Retraining

Run:

```bat
python -m ml.train_model
```

The command overwrites only the local JSON model artifact. Review the validation metrics and rerun the full test suite after retraining.
