"use client";

import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { EditorView } from "@codemirror/view";
import { useMemo, useRef } from "react";
import type { ActivityMetrics, Language } from "../lib/types";

type Props = {
  value: string;
  language: Language;
  onChange: (value: string) => void;
  metrics: ActivityMetrics;
  onMetrics: (next: ActivityMetrics) => void;
  height?: string;
  ariaLabel?: string;
};

const languageExtension = (language: Language) => {
  if (language === "Python") return python();
  if (language === "JavaScript") return javascript({ jsx: true });
  if (language === "Java") return java();
  return cpp();
};

export function CodeEditor({
  value,
  language,
  onChange,
  metrics,
  onMetrics,
  height = "430px",
  ariaLabel = "Code editor",
}: Props) {
  const pastePending = useRef(false);
  const lastChangeAt = useRef<number | null>(null);
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  const extensions = useMemo(
    () => [
      languageExtension(language),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        paste: () => {
          pastePending.current = true;
          return false;
        },
        focus: () => {
          const current = metricsRef.current;
          onMetrics({
            ...current,
            focusChanges: current.focusChanges + 1,
            sessions: current.sessions + 1,
            timeline: [...current.timeline, { at: current.totalTimeMs, length: value.length, kind: "focus" }].slice(-24),
          });
          return false;
        },
      }),
      EditorView.theme({
        "&": { backgroundColor: "#0b1324", color: "#e5edf7", fontSize: "14px" },
        ".cm-scroller": { backgroundColor: "#0b1324" },
        ".cm-content": { color: "#e5edf7", fontFamily: "var(--font-geist-mono), Consolas, monospace", padding: "16px 0" },
        ".cm-line": { padding: "0 18px" },
        ".cm-gutters": { backgroundColor: "#0f1b30", color: "#7c91aa", border: "none" },
        ".cm-activeLineGutter": { backgroundColor: "#16243b", color: "#d5e2f0" },
        ".cm-activeLine": { backgroundColor: "rgba(31, 211, 199, .045)" },
        ".cm-cursor": { borderLeftColor: "#27d3c3", borderLeftWidth: "2px" },
        ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(32, 191, 174, .25)" },
        ".cm-scroller": { scrollbarColor: "#334155 #0b1324" },
        ".cm-keyword": { color: "#7dd3fc", fontWeight: 700 },
        ".cm-operator": { color: "#cbd5e1" },
        ".cm-variableName": { color: "#e5edf7" },
        ".cm-typeName": { color: "#93c5fd" },
        ".cm-propertyName": { color: "#a5f3fc" },
        ".cm-string": { color: "#86efac" },
        ".cm-number": { color: "#f9d27a" },
        ".cm-comment": { color: "#7c8ca3", fontStyle: "italic" },
        ".cm-definitionName": { color: "#f0abfc" },
        ".cm-meta": { color: "#9fd5ff" },
        ".cm-builtin": { color: "#fda4af" },
      }),
    ],
    [language, onMetrics, value.length],
  );

  return (
    <div className="code-editor-shell" aria-label={ariaLabel}>
      <CodeMirror
        value={value}
        height={height}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          indentOnInput: true,
          tabSize: 4,
        }}
        onChange={(next, update) => {
          const now = Date.now();
          let inserted = 0;
          let deleted = 0;
          update.changes.iterChanges((fromA, toA, _fromB, _toB, insertedText) => {
            deleted += toA - fromA;
            inserted += insertedText.length;
          });
          const current = metricsRef.current;
          const elapsed = lastChangeAt.current ? now - lastChangeAt.current : 0;
          const paused = elapsed > 5_000;
          const pasted = pastePending.current;
          const kind = deleted > 0 && inserted === 0 ? "delete" : pasted ? "paste" : "type";
          const nextMetrics: ActivityMetrics = {
            ...current,
            typedCharacters: current.typedCharacters + (pasted ? 0 : inserted),
            pastedCharacters: current.pastedCharacters + (pasted ? inserted : 0),
            pasteEvents: current.pasteEvents + (pasted ? 1 : 0),
            largeInsertions: current.largeInsertions + (inserted >= 40 ? 1 : 0),
            deletions: current.deletions + deleted,
            corrections: current.corrections + (deleted > 0 ? 1 : 0),
            replacements: current.replacements + (deleted > 0 && inserted > 0 ? 1 : 0),
            activeTimeMs: current.activeTimeMs + (elapsed > 0 && elapsed <= 5_000 ? elapsed : 0),
            totalTimeMs: Math.max(current.totalTimeMs, current.totalTimeMs + Math.min(elapsed, 5_000)),
            pauses: current.pauses + (paused ? 1 : 0),
            changes: current.changes + 1,
            timeline: [...current.timeline, { at: current.totalTimeMs, length: next.length, kind }].slice(-24),
          };
          pastePending.current = false;
          lastChangeAt.current = now;
          metricsRef.current = nextMetrics;
          onMetrics(nextMetrics);
          onChange(next);
        }}
      />
    </div>
  );
}
