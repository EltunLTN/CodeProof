import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCode, scoreAssessment } from "../app/lib/analysis";
import { cloneDemo } from "../app/lib/demos";
import { exportResultJson, parseHistory, serializeHistory } from "../app/lib/history";
import { emptyActivity } from "../app/lib/types";

test("a verified learner receives a high score", () => {
  const result = scoreAssessment(cloneDemo("verified"));
  assert.ok(result.score >= 75, `expected high score, received ${result.score}`);
  assert.ok(["Verified Understanding", "Strong Understanding"].includes(result.category));
});

test("mixed evidence produces a medium score", () => {
  const result = scoreAssessment(cloneDemo("partial"));
  assert.ok(result.score >= 45 && result.score <= 75, `expected medium score, received ${result.score}`);
});

test("pasted content plus weak answers produces a low score", () => {
  const result = scoreAssessment(cloneDemo("unverified"));
  assert.ok(result.score < 45, `expected low score, received ${result.score}`);
  assert.equal(result.category, "Execution Without Verified Understanding");
});

test("clean code alone does not produce high understanding", () => {
  const input = cloneDemo("verified");
  input.explanation = "";
  input.verification = { output: "", edge: "", modifiedCode: "", modificationExplanation: "" };
  const result = scoreAssessment(input);
  assert.ok(result.score < 40);
  assert.equal(result.category, "Insufficient Evidence");
});

test("AI-style probability alone does not decide the result", () => {
  const input = cloneDemo("verified");
  input.codeActivity = { ...emptyActivity(), pastedCharacters: input.code.length, pasteEvents: 1, largeInsertions: 1, activeTimeMs: 2_000, totalTimeMs: 3_000, changes: 1, sessions: 1 };
  input.explanationActivity = { ...emptyActivity(), pastedCharacters: input.explanation.length, pasteEvents: 1, largeInsertions: 1, activeTimeMs: 2_000, totalTimeMs: 3_000, changes: 1, sessions: 1 };
  const result = scoreAssessment(input);
  assert.ok(result.codeAiProbability >= 60);
  assert.ok(result.breakdown.interactive >= 75);
  assert.ok(result.score >= 65, `strong verification should recover, received ${result.score}`);
});

test("pasted code can recover through strong live evidence", () => {
  const input = cloneDemo("verified");
  input.codeActivity = { ...emptyActivity(), pastedCharacters: input.code.length, pasteEvents: 1, largeInsertions: 1, activeTimeMs: 5_000, totalTimeMs: 7_000, changes: 1, sessions: 1 };
  const result = scoreAssessment(input);
  assert.ok(result.score >= 70);
});

test("scores stay bounded and all required fields are returned", () => {
  for (const key of ["verified", "partial", "unverified"] as const) {
    const result = scoreAssessment(cloneDemo(key));
    assert.ok(result.score >= 0 && result.score <= 100);
    for (const field of ["category", "risk", "confidence", "breakdown", "codeAiProbability", "explanationAiProbability", "positives", "risks", "recommendations"]) {
      assert.ok(field in result, `missing ${field}`);
    }
  }
});

test("empty and invalid code do not crash analysis", () => {
  const empty = analyzeCode("", "Python");
  const invalid = analyzeCode("def broken(:\n  return [", "Python");
  assert.equal(empty.valid, false);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.length > 0);
});

test("demo scenarios produce meaningfully different results", () => {
  const results = ["verified", "partial", "unverified"].map((key) => scoreAssessment(cloneDemo(key as "verified" | "partial" | "unverified")));
  const scores = results.map((result) => result.score);
  assert.ok(scores[0] - scores[1] >= 10, scores.join(", "));
  assert.ok(scores[1] - scores[2] >= 10, scores.join(", "));
  assert.deepEqual(results.map((result) => result.risk), ["Low", "Moderate", "High"]);
});

test("history saving and result export round-trip", () => {
  const result = scoreAssessment(cloneDemo("verified"));
  const saved = serializeHistory([result]);
  const loaded = parseHistory(saved);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, result.id);
  assert.deepEqual(JSON.parse(exportResultJson(result)), result);
  assert.deepEqual(parseHistory("not-json"), []);
});
