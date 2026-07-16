import { scoringConfig } from "./scoring-config";
import modelArtifact from "./generated-model.json";
import type {
  ActivityMetrics,
  AssessmentInput,
  AssessmentResult,
  CodeAnalysis,
  Language,
  VerificationQuestion,
} from "./types";

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Math.round(value)));

const ratio = (part: number, total: number) =>
  total <= 0 ? 0 : Math.min(1, part / total);

const unique = <T,>(items: T[]) => [...new Set(items)];

const languageKeywords: Record<Language, Set<string>> = {
  Python: new Set("and as assert async await break class continue def del elif else except false finally for from global if import in is lambda none nonlocal not or pass raise return true try while with yield print len sum range".split(" ")),
  JavaScript: new Set("async await break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while with yield console log".split(" ")),
  Java: new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new null package private protected public return short static strictfp super switch synchronized this throw throws transient true try void volatile while string system out println".split(" ")),
  "C++": new Set("alignas alignof and asm auto bool break case catch char class const constexpr continue default delete do double else enum explicit export extern false float for friend if inline int long namespace new noexcept nullptr operator private protected public register reinterpret_cast return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while cout cin endl std".split(" ")),
};

function balanced(code: string) {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let quote = "";
  let escaped = false;
  for (const char of code) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\" && quote) {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? "" : char;
      continue;
    }
    if (quote) continue;
    if ("([{ ".includes(char) && char !== " ") stack.push(char);
    if (pairs[char] && stack.pop() !== pairs[char]) return false;
  }
  return stack.length === 0 && !quote;
}

export function analyzeCode(code: string, language: Language): CodeAnalysis {
  const lines = code.replace(/\r/g, "").split("\n");
  const trimmed = code.trim();
  const identifiers = unique(
    (code.match(/[A-Za-z_$][\w$]*/g) ?? [])
      .map((item) => item.toLowerCase())
      .filter((item) => item.length > 1 && !languageKeywords[language].has(item)),
  );
  const functionPatterns: Record<Language, RegExp> = {
    Python: /\bdef\s+([A-Za-z_]\w*)\s*\(/g,
    JavaScript: /(?:\bfunction\s+|\bconst\s+|\blet\s+|\bvar\s+)([A-Za-z_$][\w$]*)\s*(?:=\s*(?:async\s*)?\([^)]*\)\s*=>|\()/g,
    Java: /(?:public|private|protected|static|final|synchronized|\s)+[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/g,
    "C++": /(?:[\w:<>*&]+\s+)+([A-Za-z_]\w*)\s*\([^;]*\)\s*\{/g,
  };
  const variablePatterns: Record<Language, RegExp> = {
    Python: /^\s*([A-Za-z_]\w*)\s*=\s*(?!=)/gm,
    JavaScript: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    Java: /\b(?:int|double|float|long|boolean|String|List<[^>]+>|\w+\[\])\s+([A-Za-z_]\w*)\s*(?:=|;)/g,
    "C++": /\b(?:int|double|float|long|bool|string|vector<[^>]+>)\s+([A-Za-z_]\w*)\s*(?:=|;|\{)/g,
  };
  const collect = (pattern: RegExp) => {
    const found: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code))) found.push(match[1]);
    return unique(found);
  };
  const functions = collect(functionPatterns[language]);
  const variables = collect(variablePatterns[language]);
  const imports = unique(
    lines
      .filter((line) => /^\s*(?:import|from|#include|using\s+namespace|package)\b/.test(line))
      .map((line) => line.trim()),
  );
  const loops = (code.match(/\b(?:for|while)\b/g) ?? []).length;
  const conditions = (code.match(/\b(?:if|else if|elif|switch|case)\b/g) ?? []).length;
  const comments = lines.filter((line) => /^\s*(?:#|\/\/|\/\*)/.test(line)).length;
  const concepts: string[] = [];
  if (functions.length) concepts.push("functions");
  if (loops) concepts.push("iteration");
  if (conditions) concepts.push("conditional logic");
  if (/\b(sum|reduce)\s*\(/.test(code) && /\b(len|length|size)\b/.test(code)) concepts.push("average calculation");
  if (/\b(sort|sorted)\s*\(/.test(code)) concepts.push("sorting");
  if (/\b(map|filter|reduce)\s*\(/.test(code)) concepts.push("collection transformation");
  if (/\b(class|interface)\b/.test(code)) concepts.push("object-oriented design");
  if (/\b(model|fit|predict|train_test_split|accuracy|precision|recall)\b/i.test(code)) concepts.push("machine learning workflow");
  if (/\btry\b|\bcatch\b|\bexcept\b/.test(code)) concepts.push("error handling");
  if (!concepts.length && trimmed) concepts.push("sequential operations");

  const edgeCases: string[] = [];
  if (/\b(len|length|size)\b/.test(code) && /\//.test(code)) edgeCases.push("empty collection or division by zero");
  if (/\[[^\]]*\]/.test(code)) edgeCases.push("empty collection");
  if (/\b(?:int|parseInt|float|Number|stod|stoi)\s*\(/.test(code)) edgeCases.push("invalid numeric input");
  if (loops) edgeCases.push("zero iterations or loop boundary");
  if (conditions) edgeCases.push("values exactly on a condition boundary");
  if (/\bmodel\b|\bfit\b|\bpredict\b/i.test(code)) edgeCases.push("data leakage or unseen data");
  if (!edgeCases.length) edgeCases.push("empty or unexpected input");

  const sampleNumbers = (code.match(/-?\b\d+(?:\.\d+)?\b/g) ?? [])
    .map(Number)
    .filter(Number.isFinite)
    .slice(0, 20);
  const arrayMatch = code.match(/\[\s*(-?\d+(?:\.\d+)?(?:\s*,\s*-?\d+(?:\.\d+)?)*)\s*\]/);
  const sampleArray = arrayMatch
    ? arrayMatch[1].split(",").map((item) => Number(item.trim()))
    : [];

  const issues: string[] = [];
  if (!trimmed) issues.push("No code submitted");
  if (!balanced(code)) issues.push("Unbalanced brackets or quotes");
  if (language === "Python") {
    const blockLines = lines.filter((line) => /^\s*(?:def|if|elif|else|for|while|try|except|class)\b/.test(line));
    if (blockLines.some((line) => !line.trimEnd().endsWith(":"))) issues.push("A Python block may be missing a colon");
  } else if (trimmed && !/[;{}]/.test(code)) {
    issues.push("Expected statement terminators or braces were not detected");
  }
  const nonEmpty = lines.filter((line) => line.trim()).length;
  const longLines = lines.filter((line) => line.length > 100).length;
  const named = identifiers.filter((item) => item.length > 2 && !/^[a-z]$/.test(item)).length;
  const readability = clamp(48 + Math.min(22, named * 3) + Math.min(10, comments * 3) - longLines * 5 - issues.length * 12);
  const structure = Math.min(36, functions.length * 12 + loops * 6 + conditions * 6 + imports.length * 4);
  const quality = clamp(35 + structure + readability * 0.32 - issues.length * 14 + (nonEmpty >= 3 ? 8 : 0));
  const complexity = structure >= 28 || nonEmpty > 35 ? "Advanced" : structure >= 12 || nonEmpty > 12 ? "Intermediate" : "Introductory";

  return {
    valid: trimmed.length > 0 && issues.length === 0,
    complexity,
    readability,
    quality,
    functions,
    variables,
    imports,
    concepts: unique(concepts),
    edgeCases: unique(edgeCases),
    conditions,
    loops,
    comments,
    identifiers,
    sampleNumbers,
    sampleArray,
    issues,
  };
}

function averageOutput(analysis: CodeAnalysis) {
  if (!analysis.concepts.includes("average calculation") || !analysis.sampleArray.length) return null;
  return analysis.sampleArray.reduce((total, value) => total + value, 0) / analysis.sampleArray.length;
}

export function generateQuestions(code: string, language: Language): VerificationQuestion[] {
  const analysis = analyzeCode(code, language);
  const mainFunction = analysis.functions[0] ?? "the submitted program";
  const mainVariable = analysis.variables[0] ?? analysis.identifiers[0] ?? "input";
  const average = averageOutput(analysis);
  const concrete = average !== null
    ? `Using the list [${analysis.sampleArray.join(", ")}], what exact value does ${mainFunction} produce? Walk through the calculation.`
    : analysis.loops
      ? `For the sample values already in the code, what does ${mainFunction} produce and how many loop iterations occur?`
      : `For the values currently assigned to ${mainVariable}, predict one concrete result produced by the program. Why?`;
  const expectedOutput = average !== null
    ? [String(Number(average.toFixed(4))), "sum", String(analysis.sampleArray.length)]
    : [mainFunction.toLowerCase(), mainVariable.toLowerCase()];
  const edge = analysis.edgeCases[0];
  const lastValue = analysis.sampleArray.at(-1);
  const changedValue = lastValue !== undefined ? lastValue + 12 : analysis.sampleNumbers.at(-1);
  const modificationPrompt = lastValue !== undefined
    ? `Change the last list value (${lastValue}) to ${changedValue}. Update the code, predict the new result, and explain why it changes.`
    : analysis.conditions
      ? `Change one important condition involving ${mainVariable}. Update the code, predict the new behavior, and explain the causal effect.`
      : `Change one important line involving ${mainVariable}. Update the code, predict the new behavior, and explain why it changes.`;
  const modifiedAverage = lastValue !== undefined && average !== null
    ? (analysis.sampleArray.slice(0, -1).reduce((a, b) => a + b, 0) + (changedValue ?? lastValue)) / analysis.sampleArray.length
    : null;

  return [
    {
      category: "output",
      title: "Output prediction",
      prompt: concrete,
      hint: `Reference ${mainFunction} and show the execution steps, not only the final value.`,
      expectedTokens: expectedOutput,
    },
    {
      category: "edge",
      title: "Edge case",
      prompt: `What happens when the program receives ${edge}? Identify the exact operation or branch affected and explain why.`,
      hint: `Tie the edge case to ${analysis.variables.slice(0, 2).join(" or ") || mainFunction}.`,
      expectedTokens: edge.toLowerCase().split(/\W+/).filter((word) => word.length > 3),
    },
    {
      category: "modification",
      title: "Code modification",
      prompt: modificationPrompt,
      hint: "Make the edit in the code box, then connect the changed line to the new behavior.",
      expectedTokens: [
        ...(changedValue !== undefined ? [String(changedValue)] : []),
        ...(modifiedAverage !== null ? [String(Number(modifiedAverage.toFixed(4)))] : []),
        mainVariable.toLowerCase(),
      ],
    },
  ];
}

function textMatchScore(text: string, tokens: string[]) {
  const normalized = text.toLowerCase();
  const useful = unique(tokens.map((token) => token.toLowerCase()).filter((token) => token.length > 1));
  if (!useful.length) return 0;
  return ratio(useful.filter((token) => normalized.includes(token)).length, Math.min(useful.length, 3));
}

function explanationScore(explanation: string, analysis: CodeAnalysis) {
  const text = explanation.toLowerCase().trim();
  if (!text) return 0;
  const identifierMatches = analysis.identifiers.filter((item) => text.includes(item)).length;
  const specificity = ratio(identifierMatches, Math.min(4, Math.max(1, analysis.identifiers.length)));
  const flow = /first|then|next|finally|return|print|loop|branch|condition/.test(text) ? 1 : 0;
  const cause = /because|therefore|so that|which means|in order to|results? in/.test(text) ? 1 : 0;
  const edge = /empty|zero|invalid|edge|boundary|null|none|leak|unseen/.test(text) ? 1 : 0;
  const approach = /approach|use|chose|efficient|readable|complexity|simpl/.test(text) ? 1 : 0;
  const generic = /^(this code|the program) (processes|handles|works with) (the )?(data|input).{0,40}$/i.test(text);
  const lengthFactor = Math.min(1, text.split(/\s+/).length / 75);
  return clamp(specificity * 42 + flow * 14 + cause * 14 + edge * 12 + approach * 8 + lengthFactor * 10 - (generic ? 32 : 0));
}

function activityScore(activity: ActivityMetrics) {
  const totalChars = activity.typedCharacters + activity.pastedCharacters;
  const paste = ratio(activity.pastedCharacters, totalChars);
  const editEvidence = Math.min(1, (activity.deletions + activity.corrections * 2 + activity.replacements * 2) / Math.max(16, totalChars * 0.12));
  const durationEvidence = Math.min(1, activity.activeTimeMs / 45_000);
  const sessionEvidence = Math.min(1, activity.sessions / 2);
  const instantPenalty = Math.min(1, activity.largeInsertions / 2);
  return clamp(66 - paste * 45 - instantPenalty * 16 + editEvidence * 22 + durationEvidence * 17 + sessionEvidence * 7);
}

function aiProbability(text: string, activity: ActivityMetrics, kind: "code" | "explanation") {
  const totalChars = activity.typedCharacters + activity.pastedCharacters;
  const paste = ratio(activity.pastedCharacters, totalChars);
  const features = [
    paste,
    Math.min(1, activity.largeInsertions / 2),
    Math.min(1, (activity.deletions + activity.corrections * 2) / Math.max(1, totalChars)),
    Math.min(2, (activity.activeTimeMs / 1000) / (Math.max(1, totalChars) / 100)),
    Math.min(1, (text.match(/\b(furthermore|moreover|therefore|robust|leverages|utilizes|comprehensive|scalable|seamless|optimal)\b/gi) ?? []).length / 3),
    /processes the data|efficient and robust|various edge cases|handles the input|returns the result/i.test(text) ? 1 : 0,
    text.trim().split(/\s+/).filter(Boolean).length > 35 && activity.activeTimeMs < 12_000 ? 1 : 0,
    kind === "explanation" ? 1 : 0,
  ];
  const standardized = features.map((value, index) =>
    (value - modelArtifact.scaler_mean[index]) / modelArtifact.scaler_scale[index],
  );
  const logit = modelArtifact.intercept + standardized.reduce(
    (sum, value, index) => sum + value * modelArtifact.coefficients[index],
    0,
  );
  return clamp((1 / (1 + Math.exp(-logit))) * 100);
}

function verificationScores(input: AssessmentInput, questions: VerificationQuestion[]) {
  const { verification } = input;
  const outputQuestion = questions.find((q) => q.category === "output")!;
  const edgeQuestion = questions.find((q) => q.category === "edge")!;
  const modificationQuestion = questions.find((q) => q.category === "modification")!;
  const analysis = analyzeCode(input.code, input.details.language);
  const outputText = verification.output.trim();
  const outputMatch = textMatchScore(outputText, outputQuestion.expectedTokens);
  const outputReasoning = /because|sum|divide|loop|iteration|return|print|condition|then/.test(outputText.toLowerCase()) ? 1 : 0;
  const outputSpecific = textMatchScore(outputText, analysis.identifiers.slice(0, 4));
  const output = clamp(outputMatch * 64 + outputReasoning * 22 + outputSpecific * 14);

  const edgeText = verification.edge.trim();
  const edgeMatch = textMatchScore(edgeText, edgeQuestion.expectedTokens);
  const edgeReasoning = /because|would|causes|results|division|branch|condition|index|loop|return/.test(edgeText.toLowerCase()) ? 1 : 0;
  const edgeSpecific = textMatchScore(edgeText, analysis.identifiers.slice(0, 4));
  const edge = clamp(edgeMatch * 57 + edgeReasoning * 25 + edgeSpecific * 18);

  const changed = verification.modifiedCode.trim() !== input.code.trim() && verification.modifiedCode.trim().length > 0;
  const modifiedAnalysis = analyzeCode(verification.modifiedCode, input.details.language);
  const modText = verification.modificationExplanation.trim();
  const modMatch = textMatchScore(modText, modificationQuestion.expectedTokens);
  const predicts = /becomes|changes? to|new (?:output|result)|now (?:returns|prints)|will (?:return|print|produce)/i.test(modText) ? 1 : 0;
  const causal = /because|therefore|so the|which changes|as a result|divid/.test(modText.toLowerCase()) ? 1 : 0;
  const modification = clamp((changed ? 36 : 0) + (modifiedAnalysis.valid ? 12 : 0) + modMatch * 28 + predicts * 12 + causal * 12);
  return { output, edge, modification };
}

function id() {
  return `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function scoreAssessment(input: AssessmentInput): AssessmentResult {
  const analysis = analyzeCode(input.code, input.details.language);
  const questions = generateQuestions(input.code, input.details.language);
  const explanationQuality = explanationScore(input.explanation, analysis);
  const verification = verificationScores(input, questions);
  const iw = scoringConfig.interactiveWeights;
  const interactive = clamp(
    verification.output * iw.outputPrediction +
    verification.edge * iw.edgeCase +
    verification.modification * iw.codeModification,
  );
  const identifierEvidence = textMatchScore(
    `${input.explanation} ${input.verification.output} ${input.verification.edge} ${input.verification.modificationExplanation}`,
    analysis.identifiers.slice(0, 6),
  );
  const codeUnderstanding = clamp(explanationQuality * 0.42 + interactive * 0.48 + identifierEvidence * 10);
  const codeBehavior = activityScore(input.codeActivity);
  const explanationBehavior = activityScore(input.explanationActivity);
  const behaviorAuthenticity = clamp(codeBehavior * 0.55 + explanationBehavior * 0.45);
  const writtenVsLiveGap = Math.abs(explanationQuality - interactive);
  const consistency = clamp(100 - writtenVsLiveGap * 1.05 + identifierEvidence * 10);
  const w = scoringConfig.weights;
  let score = clamp(
    interactive * w.interactive +
    explanationQuality * w.explanation +
    codeUnderstanding * w.codeUnderstanding +
    behaviorAuthenticity * w.behaviorAuthenticity +
    consistency * w.consistency,
  );
  const evidenceComplete = Boolean(
    input.code.trim() && input.explanation.trim() && input.verification.output.trim() &&
    input.verification.edge.trim() && input.verification.modifiedCode.trim() &&
    input.verification.modificationExplanation.trim(),
  );
  if (!analysis.valid) score = Math.min(score, 58);
  if (!evidenceComplete) score = Math.min(score, 29);
  const codePasteRatio = ratio(input.codeActivity.pastedCharacters, input.codeActivity.typedCharacters + input.codeActivity.pastedCharacters);
  const explanationPasteRatio = ratio(input.explanationActivity.pastedCharacters, input.explanationActivity.typedCharacters + input.explanationActivity.pastedCharacters);
  const codeAiProbability = aiProbability(input.code, input.codeActivity, "code");
  const explanationAiProbability = aiProbability(input.explanation, input.explanationActivity, "explanation");

  let category: AssessmentResult["category"];
  if (!evidenceComplete) category = "Insufficient Evidence";
  else if (interactive < scoringConfig.thresholds.lowInteractive && analysis.quality >= 50 && (codePasteRatio > 0.7 || explanationPasteRatio > 0.7)) category = "Execution Without Verified Understanding";
  else if (score >= scoringConfig.thresholds.verified) category = "Verified Understanding";
  else if (score >= scoringConfig.thresholds.strong) category = "Strong Understanding";
  else if (score >= scoringConfig.thresholds.partial) category = "Partial Understanding";
  else category = "Limited Understanding";

  const risk: AssessmentResult["risk"] = !evidenceComplete
    ? "Critical Evidence Gap"
    : interactive < 32 && (codePasteRatio > 0.72 || explanationPasteRatio > 0.72)
      ? "High"
      : score < 68 || writtenVsLiveGap > 38
        ? "Moderate"
        : "Low";
  const answerWords = [input.verification.output, input.verification.edge, input.verification.modificationExplanation].join(" ").trim().split(/\s+/).filter(Boolean).length;
  const confidence: AssessmentResult["confidence"] = evidenceComplete && answerWords > 45
    ? "High"
    : evidenceComplete && answerWords > 18
      ? "Medium"
      : "Low";

  const positives: string[] = [];
  const risks: string[] = [];
  if (verification.output >= 70) positives.push("Correctly predicted the concrete output and showed the execution steps");
  if (verification.edge >= 65) positives.push("Identified a relevant edge case tied to the submitted code");
  if (verification.modification >= 70) positives.push("Successfully modified an important line and predicted the effect");
  if (explanationQuality >= 65) positives.push("Explanation referenced actual code elements and cause-and-effect logic");
  if (consistency >= 72) positives.push("Written explanation and live answers were consistent");
  if (codePasteRatio < 0.25 && input.codeActivity.changes > 3) positives.push("Gradual editing and meaningful code changes supported authorship evidence");
  if (!positives.length) positives.push("A complete code sample provided a basis for verification");
  if (codePasteRatio > 0.72) risks.push("Most code appeared in large paste events with limited editing");
  if (explanationPasteRatio > 0.72) risks.push("Most explanation text appeared in large paste events");
  if (explanationQuality < 48) risks.push("The explanation was generic or did not reference enough actual code elements");
  if (verification.output < 50) risks.push("The concrete output prediction or reasoning was incomplete");
  if (verification.edge < 50) risks.push("The edge case was not technically connected to the program");
  if (verification.modification < 50) risks.push("The modification did not include a valid change and causal prediction");
  if (writtenVsLiveGap > 35) risks.push("Live answers were inconsistent with the written explanation");
  if (!risks.length) risks.push("No material evidence gap was detected");

  const recommendations: string[] = [];
  if (analysis.edgeCases.some((item) => item.includes("empty collection"))) recommendations.push("Add or explain an explicit empty-collection guard before processing values.");
  if (verification.output < 65) recommendations.push("Trace one sample input line by line and state each intermediate value before the final output.");
  if (verification.modification < 65) recommendations.push("Practice changing one input or condition, then connect that edit to the exact new behavior.");
  if (!recommendations.length) recommendations.push("Extend the solution with one boundary-focused test and explain why it should pass.");

  return {
    id: id(),
    input: { ...input, completedAt: input.completedAt ?? new Date().toISOString() },
    analysis,
    questions,
    score,
    category,
    risk,
    confidence,
    breakdown: {
      codeQuality: analysis.quality,
      codeUnderstanding,
      explanationQuality,
      interactive,
      outputPrediction: verification.output,
      edgeCase: verification.edge,
      codeModification: verification.modification,
      behaviorAuthenticity,
      consistency,
    },
    codeAiProbability,
    explanationAiProbability,
    codePasteRatio,
    explanationPasteRatio,
    positives: positives.slice(0, 5),
    risks: risks.slice(0, 5),
    recommendations: recommendations.slice(0, 2),
  };
}

export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
