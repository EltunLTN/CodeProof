import type { ActivityMetrics, AssessmentInput, Language } from "./types";

export type DemoKey = "verified" | "partial" | "unverified";

type DemoScenario = {
  key: DemoKey;
  label: string;
  shortLabel: string;
  description: string;
  input: AssessmentInput;
};

const activity = (overrides: Partial<ActivityMetrics>): ActivityMetrics => ({
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
  sessions: 1,
  checkpoints: 0,
  changes: 0,
  timeline: [],
  ...overrides,
});

const averageCode = `def calculate_average(numbers):
    if not numbers:
        return 0
    total = sum(numbers)
    return total / len(numbers)

scores = [12, 18, 24, 30]
print(calculate_average(scores))`;

const verifiedExplanation = `The calculate_average function receives numbers and first checks whether the list is empty. That guard returns 0 so the later division cannot use len(numbers) equal to zero. For a non-empty list, sum(numbers) produces the total and len(numbers) produces the item count; dividing total by that count returns the arithmetic mean. The scores list is passed to the function and print displays the result. I used a small function because the calculation is reusable and the early return keeps the edge case explicit.`;

const base = (
  studentName: string,
  title: string,
  language: Language,
  taskDescription: string,
): AssessmentInput => ({
  details: { studentName, assessmentTitle: title, language, taskDescription },
  code: averageCode,
  explanation: "",
  codeActivity: activity({}),
  explanationActivity: activity({}),
  verification: { output: "", edge: "", modifiedCode: averageCode, modificationExplanation: "" },
  startedAt: new Date().toISOString(),
});

const verified = base("Maya Chen", "Average Calculator", "Python", "Write a function that calculates the average of a list of scores and safely handles an empty list.");
verified.explanation = verifiedExplanation;
verified.codeActivity = activity({
  typedCharacters: 188,
  pastedCharacters: 0,
  deletions: 24,
  corrections: 7,
  replacements: 2,
  activeTimeMs: 214_000,
  totalTimeMs: 278_000,
  pauses: 5,
  focusChanges: 2,
  sessions: 2,
  checkpoints: 3,
  changes: 43,
  timeline: [
    { at: 8_000, length: 28, kind: "type" },
    { at: 62_000, length: 71, kind: "type" },
    { at: 118_000, length: 66, kind: "type" },
    { at: 155_000, length: 142, kind: "checkpoint" },
    { at: 213_000, length: averageCode.length, kind: "type" },
  ],
});
verified.explanationActivity = activity({
  typedCharacters: verifiedExplanation.length,
  pastedCharacters: 0,
  deletions: 38,
  corrections: 6,
  replacements: 2,
  activeTimeMs: 186_000,
  totalTimeMs: 221_000,
  pauses: 4,
  focusChanges: 1,
  sessions: 1,
  changes: 32,
  timeline: [
    { at: 18_000, length: 56, kind: "type" },
    { at: 79_000, length: 181, kind: "type" },
    { at: 146_000, length: 337, kind: "type" },
    { at: 185_000, length: verifiedExplanation.length, kind: "type" },
  ],
});
verified.verification = {
  output: "The output is 21. sum(scores) is 84 and len(scores) is 4, so calculate_average returns 84 / 4 before print displays 21.",
  edge: "With an empty collection, the condition `if not numbers` is true and the function returns 0 immediately. That prevents total / len(numbers) from dividing by zero.",
  modifiedCode: averageCode.replace("[12, 18, 24, 30]", "[12, 18, 24, 42]"),
  modificationExplanation: "I changed the last score from 30 to 42. The new sum is 96 while the length remains 4, so the new output becomes 24 because 96 / 4 is 24.",
};

const partial = base("Jordan Lee", "Average Calculator", "Python", "Calculate the average score for a list and consider invalid inputs.");
partial.explanation = "The function checks the numbers, adds them, and divides by the length. It returns the average and prints it. The check helps with an empty list.";
partial.codeActivity = activity({
  typedCharacters: 96,
  pastedCharacters: 92,
  pasteEvents: 1,
  largeInsertions: 1,
  deletions: 9,
  corrections: 2,
  activeTimeMs: 82_000,
  totalTimeMs: 139_000,
  pauses: 3,
  focusChanges: 3,
  sessions: 2,
  checkpoints: 1,
  changes: 13,
  timeline: [
    { at: 4_000, length: 92, kind: "paste" },
    { at: 39_000, length: 124, kind: "type" },
    { at: 81_000, length: averageCode.length, kind: "type" },
  ],
});
partial.explanationActivity = activity({
  typedCharacters: 101,
  pastedCharacters: 42,
  pasteEvents: 1,
  deletions: 4,
  corrections: 1,
  activeTimeMs: 49_000,
  totalTimeMs: 72_000,
  pauses: 1,
  focusChanges: 1,
  changes: 9,
  timeline: [
    { at: 3_000, length: 42, kind: "paste" },
    { at: 48_000, length: partial.explanation.length, kind: "type" },
  ],
});
partial.verification = {
  output: "It prints 21 because the four values add to 84 and the function divides that total by 4.",
  edge: "An empty list is an edge case. The if statement notices it, but I am not sure what value should be returned.",
  modifiedCode: averageCode.replace("[12, 18, 24, 30]", "[12, 18, 24, 42]"),
  modificationExplanation: "I changed 30 to 42, so the average will go up. The list has a larger score now.",
};

const unverified = base("Alex Morgan", "Average Calculator", "Python", "Create a working program that outputs the mean of several values.");
unverified.explanation = "This code processes the data efficiently and returns a result. It uses a robust approach to handle various inputs and then displays the final answer.";
unverified.codeActivity = activity({
  pastedCharacters: averageCode.length,
  pasteEvents: 1,
  largeInsertions: 1,
  activeTimeMs: 3_000,
  totalTimeMs: 8_000,
  focusChanges: 1,
  sessions: 1,
  changes: 1,
  timeline: [{ at: 1_000, length: averageCode.length, kind: "paste" }],
});
unverified.explanationActivity = activity({
  pastedCharacters: unverified.explanation.length,
  pasteEvents: 1,
  largeInsertions: 1,
  activeTimeMs: 2_000,
  totalTimeMs: 5_000,
  sessions: 1,
  changes: 1,
  timeline: [{ at: 1_000, length: unverified.explanation.length, kind: "paste" }],
});
unverified.verification = {
  output: "It prints 84 because that is the total of the numbers.",
  edge: "A very large monitor could break the program because the output may not fit on the screen.",
  modifiedCode: averageCode,
  modificationExplanation: "I would make it faster. The result should stay the same.",
};

export const demoScenarios: Record<DemoKey, DemoScenario> = {
  verified: {
    key: "verified",
    shortLabel: "Verified learner",
    label: "Demo 1 · Verified learner",
    description: "Gradual work, specific reasoning, and a successful modification.",
    input: verified,
  },
  partial: {
    key: "partial",
    shortLabel: "Partial understanding",
    label: "Demo 2 · Partial understanding",
    description: "Mixed authorship evidence with mostly correct reasoning.",
    input: partial,
  },
  unverified: {
    key: "unverified",
    shortLabel: "Unverified execution",
    label: "Demo 3 · Execution without verification",
    description: "Instant pastes followed by weak live answers and no valid edit.",
    input: unverified,
  },
};

export function cloneDemo(key: DemoKey): AssessmentInput {
  return JSON.parse(JSON.stringify(demoScenarios[key].input));
}
