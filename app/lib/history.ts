import type { AssessmentResult } from "./types";

export function serializeHistory(results: AssessmentResult[]) {
  return JSON.stringify(results.slice(0, 50));
}

export function parseHistory(value: string | null): AssessmentResult[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AssessmentResult => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<AssessmentResult>;
      return typeof candidate.id === "string" && typeof candidate.score === "number" && Boolean(candidate.input);
    }).slice(0, 50);
  } catch {
    return [];
  }
}

export function exportResultJson(result: AssessmentResult) {
  return JSON.stringify(result, null, 2);
}
