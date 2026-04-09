// ---------------------------------------------------------------------------
// Coaching guardrails — risk classification and approval logic
//
// Every suggestion passes through classifySuggestionRisk() before delivery.
// High-risk suggestions are flagged with requiresApproval = true so the
// athlete must explicitly confirm before the system acts on them.
// ---------------------------------------------------------------------------

import type { CompletedWorkout } from "../types";
import type { AthleteStateSummary, InjuryRiskLevel } from "../memory/athlete-state";
import type { SuggestionRisk } from "./types";

type RiskInput = {
  /** The type of workout being suggested, if any. */
  suggestedWorkoutType?: CompletedWorkout["type"];
  /** How the suggested distance compares to recent average (ratio). */
  distanceRatioToRecent?: number;
  /** Current injury risk from the athlete state. */
  injuryRisk: InjuryRiskLevel;
  /** Number of hard sessions (effort ≥ 7) in the current period. */
  hardSessionCount: number;
  /** Whether the athlete already did a hard session in the last 48 hours. */
  hardSessionWithin48h: boolean;
};

type RiskClassification = {
  risk: SuggestionRisk;
  requiresApproval: boolean;
  reason: string;
};

/**
 * Classify the risk of a coaching suggestion.
 *
 * Conservative defaults:
 * - Easy / recovery suggestions are always low risk.
 * - Tempo / interval suggestions when injury risk is elevated → high risk.
 * - Back-to-back hard sessions → high risk.
 * - Distance jumps > 20% above recent average → medium or high risk.
 */
export function classifySuggestionRisk(input: RiskInput): RiskClassification {
  const { suggestedWorkoutType, distanceRatioToRecent, injuryRisk, hardSessionCount, hardSessionWithin48h } = input;

  // Hard session while injury risk is already high → always high risk
  if (injuryRisk === "high" && suggestedWorkoutType && !["easy", "recovery"].includes(suggestedWorkoutType)) {
    return {
      risk: "high",
      requiresApproval: true,
      reason: "Injury risk is high — any workout beyond easy/recovery needs your explicit OK.",
    };
  }

  // Back-to-back hard sessions
  if (hardSessionWithin48h && suggestedWorkoutType && ["tempo", "interval"].includes(suggestedWorkoutType)) {
    return {
      risk: "high",
      requiresApproval: true,
      reason: "You had a hard session within the last 48 hours — back-to-back intensity needs your approval.",
    };
  }

  // Too many hard sessions in the period
  if (hardSessionCount >= 3 && suggestedWorkoutType && ["tempo", "interval"].includes(suggestedWorkoutType)) {
    return {
      risk: "high",
      requiresApproval: true,
      reason: "Three or more hard sessions this period — adding another requires your approval.",
    };
  }

  // Moderate injury risk + intensity
  if (injuryRisk === "moderate" && suggestedWorkoutType && ["tempo", "interval"].includes(suggestedWorkoutType)) {
    return {
      risk: "medium",
      requiresApproval: true,
      reason: "Moderate injury risk — intensity work flagged for your review.",
    };
  }

  // Distance jump
  if (distanceRatioToRecent !== undefined && distanceRatioToRecent > 1.3) {
    return {
      risk: "high",
      requiresApproval: true,
      reason: `Suggested distance is ${Math.round((distanceRatioToRecent - 1) * 100)}% above your recent average — large jumps need your approval.`,
    };
  }
  if (distanceRatioToRecent !== undefined && distanceRatioToRecent > 1.2) {
    return {
      risk: "medium",
      requiresApproval: false,
      reason: `Suggested distance is ${Math.round((distanceRatioToRecent - 1) * 100)}% above your recent average — monitor how you feel.`,
    };
  }

  return {
    risk: "low",
    requiresApproval: false,
    reason: "This suggestion falls within conservative training parameters.",
  };
}

/** Truncate text to fit the Telegram outbound limit with room for framing. */
export function truncateForTelegram(text: string, maxChars = 480): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

/**
 * Standard disclaimer appended to any suggestion that touches intensity,
 * volume changes, or injury-adjacent topics.
 */
export const COACHING_DISCLAIMER =
  "This is an automated training observation, not medical advice. If anything feels off, consult a professional.";

/**
 * Return true if the most recent workout in the list happened within
 * the given number of hours from now.
 */
export function hasRecentHardSession(
  workouts: CompletedWorkout[],
  withinHours: number,
): boolean {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return workouts.some(
    (w) => w.perceivedEffort >= 7 && new Date(w.date).getTime() >= cutoff,
  );
}
