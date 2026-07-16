export const scoringConfig = {
  weights: {
    interactive: 0.46,
    explanation: 0.24,
    codeUnderstanding: 0.12,
    behaviorAuthenticity: 0.11,
    consistency: 0.07,
  },
  interactiveWeights: {
    outputPrediction: 0.34,
    edgeCase: 0.28,
    codeModification: 0.38,
  },
  thresholds: {
    verified: 86,
    strong: 72,
    partial: 50,
    limited: 30,
    highPasteRatio: 0.72,
    lowInteractive: 34,
  },
} as const;

export type ScoringConfig = typeof scoringConfig;
