// ---------------------------------------------------------------------------
// Structured memory extraction — rules and utilities that derive CoachMemory
// candidates from conversations and completed workouts
// ---------------------------------------------------------------------------

import type { CoachMemory, CoachMemoryCategory, CompletedWorkout } from "../types";
import type { ConversationThread } from "./conversation";

export type ConfidenceLevel = "high" | "medium" | "low";

/** A candidate memory signal extracted from a message or workout. */
export type ExtractionSignal = {
  category: CoachMemoryCategory;
  title: string;
  detail: string;
  confidence: ConfidenceLevel;
  sourceType: "message" | "workout";
  sourceId: string;
};

/** A pattern-based rule that matches text and produces an ExtractionSignal. */
export type ExtractionRule = {
  id: string;
  category: CoachMemoryCategory;
  patterns: RegExp[];
  deriveTitle: (matchedText: string) => string;
  deriveDetail: (matchedText: string, fullText: string) => string;
  confidence: ConfidenceLevel;
};

export const defaultExtractionRules: ExtractionRule[] = [
  {
    id: "injury-pain",
    category: "injury",
    patterns: [/\b(pain|ache|sore|tightness|strain|twinge|hurt|injury|injured|niggle)\b/i],
    deriveTitle: (text) => `Pain or discomfort signal`,
    deriveDetail: (_matched, full) =>
      `Possible injury signal in conversation: "${full.slice(0, 120)}${full.length > 120 ? "..." : ""}"`,
    confidence: "medium",
  },
  {
    id: "injury-body-part",
    category: "injury",
    patterns: [
      /\b(calf|hamstring|achilles|IT band|iliotibial|shin|hip flexor|glute|plantar|knee|ankle|quad|hip|groin)\b/i,
    ],
    deriveTitle: (text) => `Body-part mention: ${text}`,
    deriveDetail: (_matched, full) =>
      `Athlete mentioned a body part: "${full.slice(0, 120)}${full.length > 120 ? "..." : ""}"`,
    confidence: "low",
  },
  {
    id: "preference-schedule",
    category: "preference",
    patterns: [
      /\b(prefer|like|want|better|easier|always|usually|typically|tend to|rather)\b.{0,30}\b(run|workout|train|morning|evening|weekend|day)\b/i,
    ],
    deriveTitle: () => `Stated schedule or training preference`,
    deriveDetail: (_matched, full) =>
      `Athlete expressed a preference: "${full.slice(0, 120)}${full.length > 120 ? "..." : ""}"`,
    confidence: "medium",
  },
  {
    id: "goal-race",
    category: "goal",
    patterns: [
      /\b(race|marathon|half.?marathon|5k|10k|goal|target|hoping to|planning to|aiming for)\b/i,
    ],
    deriveTitle: () => `Goal or race mention`,
    deriveDetail: (_matched, full) =>
      `Athlete mentioned a goal or upcoming race: "${full.slice(0, 120)}${full.length > 120 ? "..." : ""}"`,
    confidence: "medium",
  },
  {
    id: "pattern-readiness",
    category: "pattern",
    patterns: [
      /\b(sleep|tired|fatigue|exhausted|rested|recovery|low energy|wiped out|dead legs)\b/i,
    ],
    deriveTitle: () => `Recovery or readiness signal`,
    deriveDetail: (_matched, full) =>
      `Athlete mentioned a readiness factor: "${full.slice(0, 120)}${full.length > 120 ? "..." : ""}"`,
    confidence: "low",
  },
];

/** Extract memory signals from a single message body. */
export function extractFromMessage(
  content: string,
  messageId: string,
  rules: ExtractionRule[] = defaultExtractionRules,
): ExtractionSignal[] {
  const signals: ExtractionSignal[] = [];
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      const match = content.match(pattern);
      if (match) {
        signals.push({
          category: rule.category,
          title: rule.deriveTitle(match[0]),
          detail: rule.deriveDetail(match[0], content),
          confidence: rule.confidence,
          sourceType: "message",
          sourceId: messageId,
        });
        break; // at most one signal per rule per message
      }
    }
  }
  return signals;
}

/** Extract memory signals from a completed workout's summary and metadata. */
export function extractFromWorkout(workout: CompletedWorkout): ExtractionSignal[] {
  const signals: ExtractionSignal[] = [];

  if (workout.perceivedEffort >= 8) {
    signals.push({
      category: "pattern",
      title: `High-effort ${workout.type} session on ${workout.date}`,
      detail: `${workout.date}: ${workout.type} at effort ${workout.perceivedEffort}/10, ${workout.distanceKm}km, ${workout.durationMinutes}min. ${workout.summary}`,
      confidence: "high",
      sourceType: "workout",
      sourceId: workout.id,
    });
  }

  const injuryPattern =
    /\b(pain|ache|sore|tight|strain|twinge|hurt|calf|hamstring|knee|ankle|shin|IT band)\b/i;
  if (injuryPattern.test(workout.summary)) {
    signals.push({
      category: "injury",
      title: `Possible discomfort during ${workout.type} on ${workout.date}`,
      detail: `${workout.date}: Injury-adjacent signal in workout summary — "${workout.summary}"`,
      confidence: "medium",
      sourceType: "workout",
      sourceId: workout.id,
    });
  }

  if (workout.type === "long" && workout.distanceKm >= 20) {
    signals.push({
      category: "pattern",
      title: `Long run milestone: ${workout.distanceKm}km`,
      detail: `${workout.date}: Completed a ${workout.distanceKm}km long run at effort ${workout.perceivedEffort}/10. ${workout.summary}`,
      confidence: "high",
      sourceType: "workout",
      sourceId: workout.id,
    });
  }

  return signals;
}

/** Extract memory signals from all athlete turns in a conversation thread. */
export function extractFromThread(
  thread: ConversationThread,
  rules: ExtractionRule[] = defaultExtractionRules,
): ExtractionSignal[] {
  const signals: ExtractionSignal[] = [];
  for (const turn of thread.turns) {
    if (turn.role === "athlete") {
      signals.push(...extractFromMessage(turn.content, turn.id, rules));
    }
  }
  return signals;
}

/**
 * Deduplicate signals by category + title prefix so near-duplicate extractions
 * from the same topic produce a single high-confidence candidate.
 */
export function deduplicateSignals(signals: ExtractionSignal[]): ExtractionSignal[] {
  const seen = new Map<string, ExtractionSignal>();
  for (const signal of signals) {
    const key = `${signal.category}:${signal.title.slice(0, 40).toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || confidenceRank(signal.confidence) > confidenceRank(existing.confidence)) {
      seen.set(key, signal);
    }
  }
  return Array.from(seen.values());
}

function confidenceRank(c: ConfidenceLevel): number {
  return { high: 3, medium: 2, low: 1 }[c];
}

/** Convert an ExtractionSignal into a CoachMemory candidate (id must be assigned by the caller). */
export function signalToMemoryCandidate(signal: ExtractionSignal): Omit<CoachMemory, "id"> {
  return { category: signal.category, title: signal.title, detail: signal.detail };
}
