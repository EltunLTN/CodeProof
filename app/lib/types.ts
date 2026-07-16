export type Language = "Python" | "JavaScript" | "Java" | "C++";

export type ActivityPoint = {
  at: number;
  length: number;
  kind: "type" | "paste" | "delete" | "checkpoint" | "focus";
};

export type ActivityMetrics = {
  typedCharacters: number;
  pastedCharacters: number;
  pasteEvents: number;
  largeInsertions: number;
  deletions: number;
  corrections: number;
  replacements: number;
  activeTimeMs: number;
  totalTimeMs: number;
  pauses: number;
  focusChanges: number;
  sessions: number;
  checkpoints: number;
  changes: number;
  timeline: ActivityPoint[];
};

export type StartDetails = {
  studentName: string;
  assessmentTitle: string;
  language: Language;
  taskDescription: string;
};

export type CodeAnalysis = {
  valid: boolean;
  complexity: "Introductory" | "Intermediate" | "Advanced";
  readability: number;
  quality: number;
  functions: string[];
  variables: string[];
  imports: string[];
  concepts: string[];
  edgeCases: string[];
  conditions: number;
  loops: number;
  comments: number;
  identifiers: string[];
  sampleNumbers: number[];
  sampleArray: number[];
  issues: string[];
};

export type VerificationQuestion = {
  category: "output" | "edge" | "modification";
  title: string;
  prompt: string;
  hint: string;
  expectedTokens: string[];
};

export type VerificationAnswers = {
  output: string;
  edge: string;
  modifiedCode: string;
  modificationExplanation: string;
};

export type AssessmentInput = {
  details: StartDetails;
  code: string;
  explanation: string;
  codeActivity: ActivityMetrics;
  explanationActivity: ActivityMetrics;
  verification: VerificationAnswers;
  startedAt: string;
  completedAt?: string;
};

export type ScoreBreakdown = {
  codeQuality: number;
  codeUnderstanding: number;
  explanationQuality: number;
  interactive: number;
  outputPrediction: number;
  edgeCase: number;
  codeModification: number;
  behaviorAuthenticity: number;
  consistency: number;
};

export type AssessmentResult = {
  id: string;
  input: AssessmentInput;
  analysis: CodeAnalysis;
  questions: VerificationQuestion[];
  score: number;
  category:
    | "Verified Understanding"
    | "Strong Understanding"
    | "Partial Understanding"
    | "Limited Understanding"
    | "Execution Without Verified Understanding"
    | "Insufficient Evidence";
  risk: "Low" | "Moderate" | "High" | "Critical Evidence Gap";
  confidence: "High" | "Medium" | "Low";
  breakdown: ScoreBreakdown;
  codeAiProbability: number;
  explanationAiProbability: number;
  codePasteRatio: number;
  explanationPasteRatio: number;
  positives: string[];
  risks: string[];
  recommendations: string[];
};

export const emptyActivity = (): ActivityMetrics => ({
  typedCharacters: 0,
  pastedCharacters: 0,
  pasteEvents: 0,
  largeInsertions: 0,
  deletions: 0,
  corrections: 0,
  replacements: 0,
  activeTimeMs: 0,
  totalTimeMs: 0,
  pauses: 0,
  focusChanges: 0,
  sessions: 0,
  checkpoints: 0,
  changes: 0,
  timeline: [],
});
