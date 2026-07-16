"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Code2,
  Download,
  FileCheck2,
  Gauge,
  History,
  LockKeyhole,
  Play,
  Printer,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { analyzeCode, formatDuration, generateQuestions, scoreAssessment } from "./lib/analysis";
import { cloneDemo, demoScenarios, type DemoKey } from "./lib/demos";
import { exportResultJson, parseHistory, serializeHistory } from "./lib/history";
import {
  emptyActivity,
  type ActivityMetrics,
  type AssessmentResult,
  type CodeAnalysis,
  type Language,
  type StartDetails,
  type VerificationAnswers,
  type VerificationQuestion,
} from "./lib/types";

type Step = "start" | "code" | "explanation" | "verify" | "results" | "history";

const storageKey = "codeproof-ai-history-v1";

const blankDetails: StartDetails = {
  studentName: "",
  assessmentTitle: "",
  language: "Python",
  taskDescription: "",
};

const starterCode: Record<Language, string> = {
  Python: "# Write your solution here\n",
  JavaScript: "// Write your solution here\n",
  Java: "public class Solution {\n    // Write your solution here\n}\n",
  "C++": "#include <iostream>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n",
};

const questionPrompts = [
  "What does this code do?",
  "Explain the most important logic.",
  "Why did you use this approach?",
  "What is one limitation or edge case?",
];

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const active = step === "start" ? 1 : step === "code" ? 2 : step === "explanation" ? 3 : step === "verify" ? 4 : 5;
  const labels = ["Setup", "Code", "Explain", "Verify", "Results"];
  return (
    <div className="stepper" aria-label={`Assessment progress: step ${active} of 5`}>
      {labels.map((label, index) => (
        <div className={`step ${index + 1 === active ? "active" : ""} ${index + 1 < active ? "done" : ""}`} key={label}>
          <span>{index + 1 < active ? <Check size={13} /> : index + 1}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

function EvidenceBar({ label, value, tone = "teal" }: { label: string; value: number; tone?: "teal" | "cyan" | "amber" }) {
  return (
    <div className="evidence-bar">
      <div><span>{label}</span><strong>{value}</strong></div>
      <div className="bar-track"><i className={tone} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function probabilityLabel(value: number) {
  if (value < 35) return "Low AI-style probability";
  if (value < 68) return "Moderate AI-style probability";
  return "High AI-style probability";
}

function RadarChart({ result }: { result: AssessmentResult }) {
  const values = [
    result.breakdown.codeUnderstanding,
    result.breakdown.explanationQuality,
    result.breakdown.outputPrediction,
    result.breakdown.edgeCase,
    result.breakdown.codeModification,
  ];
  const labels = ["Code", "Explain", "Output", "Edge", "Modify"];
  const center = 100;
  const radius = 72;
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length;
    const r = radius * (value / 100);
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  }).join(" ");
  const grid = [1, .66, .33].map((scale) => labels.map((_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / labels.length;
    return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
  }).join(" "));
  return (
    <div className="radar-wrap">
      <svg viewBox="0 0 200 200" role="img" aria-label="Comparison of five assessment evidence scores">
        {grid.map((ring) => <polygon key={ring} points={ring} className="radar-grid" />)}
        {labels.map((_, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / labels.length;
          return <line key={index} x1="100" y1="100" x2={100 + Math.cos(angle) * radius} y2={100 + Math.sin(angle) * radius} />;
        })}
        <polygon points={points} className="radar-data" />
        {points.split(" ").map((point) => {
          const [x, y] = point.split(",");
          return <circle key={point} cx={x} cy={y} r="3" />;
        })}
      </svg>
      <div className="radar-labels">
        {labels.map((label, index) => <span key={label}><i />{label} <strong>{values[index]}</strong></span>)}
      </div>
    </div>
  );
}

function ActivityTimeline({ metrics }: { metrics: ActivityMetrics }) {
  const points = metrics.timeline.length ? metrics.timeline : [{ at: 0, length: 0, kind: "focus" as const }];
  const maxAt = Math.max(...points.map((point) => point.at), 1);
  return (
    <div className="timeline" aria-label="Editing activity timeline">
      <div className="timeline-line" />
      {points.slice(-12).map((point, index) => (
        <i
          key={`${point.at}-${index}`}
          className={point.kind}
          style={{ left: `${Math.min(98, 2 + (point.at / maxAt) * 94)}%` }}
          title={`${point.kind} · ${point.length} characters`}
        />
      ))}
      <div className="timeline-legend"><span>Started</span><span>{points.length} recorded moments</span><span>Submitted</span></div>
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("start");
  const [details, setDetails] = useState<StartDetails>(blankDetails);
  const [selectedDemo, setSelectedDemo] = useState<DemoKey>("verified");
  const [activeDemo, setActiveDemo] = useState<DemoKey | null>(null);
  const [code, setCode] = useState(starterCode.Python);
  const [initialCode, setInitialCode] = useState(starterCode.Python);
  const [explanation, setExplanation] = useState("");
  const [codeActivity, setCodeActivity] = useState<ActivityMetrics>(emptyActivity());
  const [explanationActivity, setExplanationActivity] = useState<ActivityMetrics>(emptyActivity());
  const [verification, setVerification] = useState<VerificationAnswers>({ output: "", edge: "", modifiedCode: "", modificationExplanation: "" });
  const [questions, setQuestions] = useState<VerificationQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [analysis, setAnalysis] = useState<CodeAnalysis | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [history, setHistory] = useState<AssessmentResult[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [stageStartedAt, setStageStartedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const pastePending = useRef(false);
  const lastExplanationChange = useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      setHistory(parseHistory(localStorage.getItem(storageKey)));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2_800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stageElapsed = now - stageStartedAt;
  const pasteRatio = (metrics: ActivityMetrics) => {
    const total = metrics.typedCharacters + metrics.pastedCharacters;
    return total ? Math.round((metrics.pastedCharacters / total) * 100) : 0;
  };

  const saveHistory = (next: AssessmentResult[]) => {
    const limited = next.slice(0, 50);
    setHistory(limited);
    localStorage.setItem(storageKey, serializeHistory(limited));
  };

  const beginStage = (next: Step) => {
    setStageStartedAt(Date.now());
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startAssessment = () => {
    const clean = {
      ...details,
      studentName: details.studentName.trim().slice(0, 80),
      assessmentTitle: details.assessmentTitle.trim().slice(0, 120),
      taskDescription: details.taskDescription.trim().slice(0, 600),
    };
    if (!clean.studentName || !clean.assessmentTitle || !clean.taskDescription) {
      setError("Complete the student name, assessment title, and task description.");
      return;
    }
    setError("");
    setDetails(clean);
    const template = starterCode[clean.language];
    setCode(template);
    setInitialCode(template);
    setExplanation("");
    setCodeActivity(emptyActivity());
    setExplanationActivity(emptyActivity());
    setVerification({ output: "", edge: "", modifiedCode: template, modificationExplanation: "" });
    setActiveDemo(null);
    setAnalysis(null);
    setStartedAt(new Date().toISOString());
    beginStage("code");
  };

  const loadDemo = () => {
    const demo = cloneDemo(selectedDemo);
    setDetails(demo.details);
    setCode(demo.code);
    setInitialCode(demo.code);
    setExplanation(demo.explanation);
    setCodeActivity(demo.codeActivity);
    setExplanationActivity(demo.explanationActivity);
    setVerification(demo.verification);
    setActiveDemo(selectedDemo);
    setAnalysis(null);
    setStartedAt(demo.startedAt);
    setError("");
    setToast(`${demoScenarios[selectedDemo].shortLabel} loaded. It will use the same scoring engine.`);
    beginStage("code");
  };

  const checkpoint = () => {
    const next = {
      ...codeActivity,
      checkpoints: codeActivity.checkpoints + 1,
      timeline: [...codeActivity.timeline, { at: codeActivity.totalTimeMs + stageElapsed, length: code.length, kind: "checkpoint" as const }].slice(-24),
    };
    setCodeActivity(next);
    setToast(`Checkpoint ${next.checkpoints} saved locally.`);
  };

  const continueToExplanation = () => {
    const report = analyzeCode(code, details.language);
    setAnalysis(report);
    if (!code.trim() || code.replace(/\/\/.*|#.*|\/\*[\s\S]*?\*\//g, "").trim().length < 8) {
      setError("Add a meaningful solution before continuing.");
      return;
    }
    setError("");
    beginStage("explanation");
  };

  const handleExplanation = (next: string) => {
    const nowTime = Date.now();
    const inserted = Math.max(0, next.length - explanation.length);
    const deleted = Math.max(0, explanation.length - next.length);
    const elapsed = lastExplanationChange.current ? nowTime - lastExplanationChange.current : 0;
    const pasted = pastePending.current;
    setExplanationActivity((current) => ({
      ...current,
      typedCharacters: current.typedCharacters + (pasted ? 0 : inserted),
      pastedCharacters: current.pastedCharacters + (pasted ? inserted : 0),
      pasteEvents: current.pasteEvents + (pasted ? 1 : 0),
      largeInsertions: current.largeInsertions + (inserted >= 80 ? 1 : 0),
      deletions: current.deletions + deleted,
      corrections: current.corrections + (deleted > 0 ? 1 : 0),
      replacements: current.replacements + (deleted > 0 && inserted > 0 ? 1 : 0),
      activeTimeMs: current.activeTimeMs + (elapsed > 0 && elapsed <= 5_000 ? elapsed : 0),
      totalTimeMs: current.totalTimeMs + Math.min(elapsed, 5_000),
      pauses: current.pauses + (elapsed > 5_000 ? 1 : 0),
      changes: current.changes + 1,
      timeline: [...current.timeline, { at: current.totalTimeMs, length: next.length, kind: pasted ? "paste" as const : deleted ? "delete" as const : "type" as const }].slice(-24),
    }));
    pastePending.current = false;
    lastExplanationChange.current = nowTime;
    setExplanation(next);
  };

  const continueToVerification = () => {
    if (explanation.trim().split(/\s+/).length < 18) {
      setError("Explain the code in enough detail to show its flow, approach, and one edge case.");
      return;
    }
    const generated = generateQuestions(code, details.language);
    setQuestions(generated);
    setVerification((current) => ({ ...current, modifiedCode: current.modifiedCode.trim() ? current.modifiedCode : code }));
    setQuestionIndex(0);
    setError("");
    beginStage("verify");
  };

  const submitAssessment = () => {
    if (!verification.output.trim() || !verification.edge.trim() || !verification.modifiedCode.trim() || !verification.modificationExplanation.trim()) {
      setError("Answer all three verification questions and make a code modification before submitting.");
      return;
    }
    const completed = scoreAssessment({
      details,
      code,
      explanation,
      codeActivity: { ...codeActivity, totalTimeMs: codeActivity.totalTimeMs || stageElapsed },
      explanationActivity,
      verification,
      startedAt,
      completedAt: new Date().toISOString(),
    });
    setResult(completed);
    saveHistory([completed, ...history.filter((item) => item.id !== completed.id)]);
    setError("");
    beginStage("results");
  };

  const exportResult = () => {
    if (!result) return;
    const blob = new Blob([exportResultJson(result)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `codeproof-${result.input.details.studentName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${result.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Assessment JSON exported.");
  };

  const resetAll = () => {
    setDetails(blankDetails);
    setCode(starterCode.Python);
    setExplanation("");
    setResult(null);
    setActiveDemo(null);
    setError("");
    beginStage("start");
  };

  const activeAnalysis = analysis ?? analyzeCode(code, details.language);
  const currentQuestion = questions[questionIndex];
  const showProgress = !["history"].includes(step);
  const historyCount = history.length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={resetAll} aria-label="CodeProof AI home">
          <span className="brand-mark"><Code2 size={20} /><ShieldCheck size={13} /></span>
          <span><strong>CodeProof</strong><em>AI</em></span>
        </button>
        {showProgress && <Stepper step={step} />}
        <nav>
          <button className="nav-button" onClick={() => beginStage("history")}><History size={17} />History <span>{historyCount}</span></button>
        </nav>
      </header>

      <main>
        {step === "start" && (
          <section className="start-layout">
            <div className="hero-copy">
              <div className="eyebrow"><Sparkles size={15} /> Holberton School · Machine Learning Demo</div>
              <h1>Measure understanding.<br /><span>Build real skills.</span></h1>
              <p>Assess whether a learner can explain, predict, debug, and modify the code they submit—regardless of whether AI helped create it.</p>
              <div className="principle-card">
                <div><Gauge size={23} /></div>
                <p><strong>Evidence over suspicion</strong><span>AI assistance is allowed. Demonstrated understanding drives the score.</span></p>
              </div>
              <div className="privacy-note"><LockKeyhole size={16} /><span><strong>Your code and assessment data remain on your local device.</strong> No cloud services, API keys, or unsafe code execution.</span></div>
            </div>

            <div className="setup-card">
              <div className="card-heading"><div><span>New assessment</span><h2>Set up the challenge</h2></div><span className="time-badge"><Clock3 size={14} /> 10–15 min</span></div>
              <div className="field-grid">
                <label><span>Student name</span><input value={details.studentName} maxLength={80} onChange={(event) => setDetails({ ...details, studentName: event.target.value })} placeholder="e.g. Maya Chen" /></label>
                <label><span>Assessment title</span><input value={details.assessmentTitle} maxLength={120} onChange={(event) => setDetails({ ...details, assessmentTitle: event.target.value })} placeholder="e.g. Average Calculator" /></label>
              </div>
              <label><span>Programming language</span><div className="language-tabs">{(["Python", "JavaScript", "Java", "C++"] as Language[]).map((language) => <button key={language} className={details.language === language ? "selected" : ""} onClick={() => setDetails({ ...details, language })}>{language}</button>)}</div></label>
              <label><span>Task description</span><textarea value={details.taskDescription} maxLength={600} onChange={(event) => setDetails({ ...details, taskDescription: event.target.value })} placeholder="Describe the programming task and expected behavior…" rows={4} /><small>{details.taskDescription.length}/600</small></label>
              {error && <div className="inline-error"><CircleAlert size={16} />{error}</div>}
              <button className="primary large" onClick={startAssessment}>Start Assessment <ArrowRight size={18} /></button>
              <div className="or"><span>or explore a complete evidence profile</span></div>
              <label><span>Demo scenario</span><select value={selectedDemo} onChange={(event) => setSelectedDemo(event.target.value as DemoKey)}>{Object.values(demoScenarios).map((demo) => <option key={demo.key} value={demo.key}>{demo.label}</option>)}</select></label>
              <p className="demo-description">{demoScenarios[selectedDemo].description}</p>
              <button className="secondary large" onClick={loadDemo}><Play size={17} />Load Demo Scenario</button>
            </div>
          </section>
        )}

        {step === "code" && (
          <section className="workspace-page">
            <div className="workspace-head">
              <div><span className="section-kicker">Step 2 · Code workspace {activeDemo && <b>Demo evidence loaded</b>}</span><h1>Build the solution</h1><p>{details.taskDescription}</p></div>
              <div className="live-card"><i /><span>Activity recorded locally</span><strong>{formatDuration(stageElapsed)}</strong></div>
            </div>
            <div className="workspace-grid">
              <div className="editor-card">
                <div className="editor-toolbar">
                  <div><Braces size={16} /><strong>{details.assessmentTitle}</strong><span>{details.language}</span></div>
                  <div>
                    <button onClick={() => { setCode(initialCode); setAnalysis(null); }}><RefreshCcw size={15} />Reset</button>
                    <button onClick={checkpoint}><Save size={15} />Checkpoint</button>
                    <button onClick={() => setAnalysis(analyzeCode(code, details.language))}><Sparkles size={15} />Analyze</button>
                  </div>
                </div>
                <CodeEditor value={code} language={details.language} onChange={(next) => { setCode(next); setAnalysis(null); }} metrics={codeActivity} onMetrics={setCodeActivity} />
                <div className="editor-status"><span><i />Editor activity only—never system-wide keystrokes</span><span>{code.split("\n").length} lines · {code.length} chars</span></div>
              </div>
              <aside className="workspace-aside">
                <div className="aside-card"><h3><Activity size={18} />Live evidence</h3><div className="metric-grid"><MetricPill label="Typed" value={codeActivity.typedCharacters} /><MetricPill label="Pasted" value={codeActivity.pastedCharacters} /><MetricPill label="Paste ratio" value={`${pasteRatio(codeActivity)}%`} /><MetricPill label="Changes" value={codeActivity.changes} /><MetricPill label="Corrections" value={codeActivity.corrections} /><MetricPill label="Checkpoints" value={codeActivity.checkpoints} /></div><p>Behavior supports the assessment but never decides it alone.</p></div>
                {analysis ? (
                  <div className="aside-card analysis-card"><h3><FileCheck2 size={18} />Static analysis</h3><div className={`analysis-state ${analysis.valid ? "valid" : "warning"}`}>{analysis.valid ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}<span>{analysis.valid ? "Structure looks valid" : "Review detected issues"}</span></div><dl><div><dt>Complexity</dt><dd>{analysis.complexity}</dd></div><div><dt>Functions</dt><dd>{analysis.functions.length}</dd></div><div><dt>Conditions</dt><dd>{analysis.conditions}</dd></div><div><dt>Loops</dt><dd>{analysis.loops}</dd></div></dl><div className="tag-list">{analysis.concepts.map((item) => <span key={item}>{item}</span>)}</div>{analysis.issues.map((issue) => <p className="issue" key={issue}>{issue}</p>)}</div>
                ) : <div className="aside-card tip-card"><BookOpenCheck size={21} /><h3>Understanding comes next</h3><p>After coding, you’ll explain your logic and answer three questions generated from this exact solution.</p></div>}
              </aside>
            </div>
            {error && <div className="inline-error bottom"><CircleAlert size={16} />{error}</div>}
            <div className="page-actions"><button className="ghost" onClick={() => beginStage("start")}><ArrowLeft size={17} />Back</button><button className="primary" onClick={continueToExplanation}>Continue to Explanation <ArrowRight size={17} /></button></div>
          </section>
        )}

        {step === "explanation" && (
          <section className="workspace-page narrow-page">
            <div className="workspace-head"><div><span className="section-kicker">Step 3 · Explanation workspace</span><h1>Explain it in your own words</h1><p>Be specific. Refer to the actual values, variables, functions, and decisions in your solution.</p></div><div className="live-card"><i /><span>Writing activity recorded</span><strong>{formatDuration(stageElapsed)}</strong></div></div>
            <div className="explanation-layout">
              <div className="prompt-list"><span>Cover these points</span>{questionPrompts.slice(0, activeAnalysis.complexity === "Introductory" ? 3 : 4).map((prompt, index) => <div key={prompt}><b>{index + 1}</b><p>{prompt}</p></div>)}</div>
              <div className="explanation-card">
                <div className="writing-toolbar"><div><BookOpenCheck size={18} /><strong>Your explanation</strong></div><span>{explanation.trim() ? explanation.trim().split(/\s+/).length : 0} words</span></div>
                <textarea aria-label="Code explanation" value={explanation} onPaste={() => { pastePending.current = true; }} onChange={(event) => handleExplanation(event.target.value)} placeholder="Start with the purpose of the code, then walk through the important logic…" />
                <div className="writing-metrics"><span>Typed <strong>{explanationActivity.typedCharacters}</strong></span><span>Pasted <strong>{explanationActivity.pastedCharacters}</strong></span><span>Paste ratio <strong>{pasteRatio(explanationActivity)}%</strong></span><span>Rewrites <strong>{explanationActivity.corrections}</strong></span></div>
              </div>
            </div>
            <div className="supporting-note"><ShieldCheck size={17} /><p><strong>No AI-writing label is shown while you write.</strong> Style signals are calculated only after submission and are treated as supporting evidence—not proof.</p></div>
            {error && <div className="inline-error bottom"><CircleAlert size={16} />{error}</div>}
            <div className="page-actions"><button className="ghost" onClick={() => beginStage("code")}><ArrowLeft size={17} />Back to Code</button><button className="primary" onClick={continueToVerification}>Generate Verification Questions <Sparkles size={17} /></button></div>
          </section>
        )}

        {step === "verify" && currentQuestion && (
          <section className="workspace-page narrow-page">
            <div className="workspace-head"><div><span className="section-kicker">Step 4 · Interactive verification</span><h1>Prove the reasoning</h1><p>These three questions were generated from your submitted program—not a generic question bank.</p></div><div className="question-counter"><strong>{questionIndex + 1}</strong><span>of 3</span></div></div>
            <div className="verify-tabs">{questions.map((question, index) => <button key={question.category} onClick={() => setQuestionIndex(index)} className={`${index === questionIndex ? "active" : ""} ${index < questionIndex ? "complete" : ""}`}><span>{index < questionIndex ? <Check size={14} /> : index + 1}</span><div><strong>{question.title}</strong><small>{question.category === "output" ? "Predict & trace" : question.category === "edge" ? "Reason about failure" : "Edit & explain"}</small></div></button>)}</div>
            <div className="question-card">
              <div className="question-heading"><span>Question {questionIndex + 1}</span><h2>{currentQuestion.prompt}</h2><p><Sparkles size={15} />{currentQuestion.hint}</p></div>
              {currentQuestion.category === "output" && <label className="answer-field"><span>Your prediction and reasoning</span><textarea value={verification.output} onChange={(event) => setVerification({ ...verification, output: event.target.value })} placeholder="State the exact result, then walk through why the code produces it…" /></label>}
              {currentQuestion.category === "edge" && <label className="answer-field"><span>Your edge-case analysis</span><textarea value={verification.edge} onChange={(event) => setVerification({ ...verification, edge: event.target.value })} placeholder="Name the input, the affected operation or branch, and the resulting behavior…" /></label>}
              {currentQuestion.category === "modification" && <div className="modification-grid"><div><span className="field-label">Modified code</span><CodeEditor value={verification.modifiedCode} language={details.language} onChange={(value) => setVerification({ ...verification, modifiedCode: value })} metrics={emptyActivity()} onMetrics={() => undefined} height="320px" ariaLabel="Modified code editor" /></div><label className="answer-field"><span>What changed, what happens now, and why?</span><textarea value={verification.modificationExplanation} onChange={(event) => setVerification({ ...verification, modificationExplanation: event.target.value })} placeholder="I changed… The new behavior is… because…" /></label></div>}
            </div>
            {error && <div className="inline-error bottom"><CircleAlert size={16} />{error}</div>}
            <div className="page-actions"><button className="ghost" onClick={() => questionIndex ? setQuestionIndex(questionIndex - 1) : beginStage("explanation")}><ArrowLeft size={17} />{questionIndex ? "Previous Question" : "Back to Explanation"}</button>{questionIndex < 2 ? <button className="primary" onClick={() => setQuestionIndex(questionIndex + 1)}>Next Question <ArrowRight size={17} /></button> : <button className="primary submit" onClick={submitAssessment}><ShieldCheck size={17} />Verify Understanding</button>}</div>
          </section>
        )}

        {step === "results" && result && (
          <section className="results-page">
            <div className="results-head">
              <div><span className="section-kicker">Assessment complete · {new Date(result.input.completedAt ?? "").toLocaleString()}</span><h1>{result.input.details.studentName} · {result.input.details.assessmentTitle}</h1><p>{result.input.details.language} assessment with {result.confidence.toLowerCase()}-confidence evidence coverage.</p></div>
              <div className="results-actions"><button onClick={exportResult}><Download size={16} />Export JSON</button><button onClick={() => window.print()}><Printer size={16} />Print report</button></div>
            </div>
            <div className="score-hero">
              <div className="score-gauge" style={{ "--score": `${result.score * 3.6}deg` } as React.CSSProperties}><div><strong>{result.score}</strong><span>/ 100</span></div></div>
              <div className="score-summary"><span>Verified Understanding Score</span><h2>{result.category}</h2><p>{result.score >= 72 ? "The learner demonstrated consistent, code-specific understanding across explanation and live verification." : result.score >= 50 ? "The learner showed useful understanding, with targeted evidence gaps to address." : "Working code was present, but live evidence did not yet verify understanding."}</p><div><span className={`risk ${result.risk.toLowerCase().replaceAll(" ", "-")}`}>Risk · {result.risk}</span><span className="confidence">Confidence · {result.confidence}</span></div></div>
              <div className="score-principle"><ShieldCheck size={24} /><p><strong>Understanding led this result</strong><span>Interactive verification carries 46% of the score—the largest single weight.</span></p></div>
            </div>

            <div className="results-grid">
              <div className="results-card evidence-card"><div className="results-card-head"><div><BarChart3 size={19} /><h3>Evidence breakdown</h3></div><span>0–100</span></div><EvidenceBar label="Code understanding" value={result.breakdown.codeUnderstanding} /><EvidenceBar label="Explanation quality" value={result.breakdown.explanationQuality} /><EvidenceBar label="Interactive questions" value={result.breakdown.interactive} tone="cyan" /><EvidenceBar label="Behavior authenticity" value={result.breakdown.behaviorAuthenticity} tone="amber" /><div className="micro-scores"><div><span>Output prediction</span><strong>{result.breakdown.outputPrediction}</strong></div><div><span>Edge-case reasoning</span><strong>{result.breakdown.edgeCase}</strong></div><div><span>Code modification</span><strong>{result.breakdown.codeModification}</strong></div></div></div>
              <div className="results-card"><div className="results-card-head"><div><Activity size={19} /><h3>Understanding profile</h3></div><span>Compared evidence</span></div><RadarChart result={result} /></div>
            </div>

            <div className="results-grid">
              <div className="results-card behavior-card"><div className="results-card-head"><div><Activity size={19} /><h3>Behavior evidence</h3></div><span>Local editor only</span></div><div className="behavior-stats"><MetricPill label="Code paste ratio" value={`${Math.round(result.codePasteRatio * 100)}%`} /><MetricPill label="Explanation paste" value={`${Math.round(result.explanationPasteRatio * 100)}%`} /><MetricPill label="Coding time" value={formatDuration(result.input.codeActivity.totalTimeMs)} /><MetricPill label="Explanation time" value={formatDuration(result.input.explanationActivity.totalTimeMs)} /></div><ActivityTimeline metrics={result.input.codeActivity} /></div>
              <div className="results-card ai-card"><div className="results-card-head"><div><Sparkles size={19} /><h3>AI-style signals</h3></div><span>Supporting evidence</span></div><div className="ai-row"><div><span>Code</span><strong>{probabilityLabel(result.codeAiProbability)}</strong></div><b>{result.codeAiProbability}%</b></div><div className="bar-track probability"><i style={{ width: `${result.codeAiProbability}%` }} /></div><div className="ai-row"><div><span>Explanation</span><strong>{probabilityLabel(result.explanationAiProbability)}</strong></div><b>{result.explanationAiProbability}%</b></div><div className="bar-track probability"><i style={{ width: `${result.explanationAiProbability}%` }} /></div><p><CircleAlert size={15} /><strong>AI-style probability is supporting evidence, not proof.</strong> Paste behavior alone never fails a learner.</p></div>
            </div>

            <div className="feedback-grid">
              <div className="feedback-card positive"><div><CheckCircle2 size={20} /><h3>Why the score increased</h3></div><ul>{result.positives.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className="feedback-card caution"><div><TriangleAlert size={20} /><h3>Why the score decreased</h3></div><ul>{result.risks.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className="feedback-card recommendation"><div><BookOpenCheck size={20} /><h3>Recommendation</h3></div>{result.recommendations.map((item) => <p key={item}>{item}</p>)}</div>
            </div>
            <div className="final-message"><p><strong>Traditional systems ask: “Did the learner use AI?”</strong><span>CodeProof AI asks: “Can the learner prove that they understand the code?”</span></p><div><button className="secondary" onClick={() => beginStage("history")}><History size={17} />View History</button><button className="primary" onClick={resetAll}>New Assessment <ArrowRight size={17} /></button></div></div>
          </section>
        )}

        {step === "history" && (
          <section className="history-page">
            <div className="history-head"><div><span className="section-kicker">Local history</span><h1>Completed assessments</h1><p>Results are stored only in this browser on this device.</p></div>{history.length > 0 && <button className="danger-button" onClick={() => { if (window.confirm("Delete all local CodeProof AI assessment history?")) { saveHistory([]); setToast("Local assessment history cleared."); } }}><Trash2 size={16} />Clear all local data</button>}</div>
            {history.length === 0 ? <div className="empty-history"><History size={32} /><h2>No completed assessments yet</h2><p>Run a normal assessment or load one of the three demo scenarios.</p><button className="primary" onClick={resetAll}>Start an Assessment <ArrowRight size={17} /></button></div> : <div className="history-list"><div className="history-labels"><span>Date</span><span>Learner & task</span><span>Language</span><span>Score</span><span>Category</span><span /></div>{history.map((item) => <div className="history-row" key={item.id}><span>{new Date(item.input.completedAt ?? "").toLocaleDateString()}</span><span><strong>{item.input.details.studentName}</strong><small>{item.input.details.assessmentTitle}</small></span><span><b>{item.input.details.language}</b></span><span className="history-score">{item.score}</span><span><em>{item.category}</em></span><span className="row-actions"><button title="Open result" onClick={() => { setResult(item); beginStage("results"); }}><ChevronRight size={18} /></button><button title="Delete result" onClick={() => saveHistory(history.filter((candidate) => candidate.id !== item.id))}><Trash2 size={16} /></button></span></div>)}</div>}
            <div className="page-actions"><button className="ghost" onClick={() => result ? beginStage("results") : resetAll()}><ArrowLeft size={17} />{result ? "Back to Result" : "Back to Start"}</button></div>
          </section>
        )}
      </main>

      <footer><div className="brand mini"><span className="brand-mark"><Code2 size={15} /><ShieldCheck size={9} /></span><span><strong>CodeProof</strong><em>AI</em></span></div><p>CodeProof AI — Measure Understanding. Build Real Skills.</p><span><LockKeyhole size={13} />100% local assessment</span></footer>
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}<button onClick={() => setToast("")}><X size={14} /></button></div>}
    </div>
  );
}
