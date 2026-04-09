// ---------------------------------------------------------------------------
// Fatigue / injury check — proactive check-in when signals indicate risk
// ---------------------------------------------------------------------------

import type { AthleteProfile, CompletedWorkout } from "../types";
import type { AthleteStateSummary } from "../memory/athlete-state";
import type { FatigueCheckResult } from "./types";
import { COACHING_DISCLAIMER, truncateForTelegram } from "./guardrails";

type FatigueCheckInput = {
  recentWorkouts: CompletedWorkout[];
  stateSummary: AthleteStateSummary;
  profile: AthleteProfile;
};

/**
 * Determines whether a fatigue/injury check-in is warranted and, if so,
 * generates a structured result. Returns null when no check is needed.
 */
export function evaluateFatigueCheck({
  recentWorkouts,
  stateSummary,
  profile,
}: FatigueCheckInput): FatigueCheckResult | null {
  const { injuryRisk, trainingLoad } = stateSummary;
  const reasons: string[] = [];
  const priorities: string[] = [];

  // Injury risk is elevated
  if (injuryRisk.level === "high") {
    reasons.push(
      `Injury risk is high. Active flags: ${injuryRisk.activeFlags.slice(0, 3).join("; ")}.`,
    );
    priorities.push("Address elevated injury risk.");
  } else if (injuryRisk.level === "moderate" && injuryRisk.recentTriggers.length > 0) {
    reasons.push(
      `Injury risk is moderate with recent triggers: ${injuryRisk.recentTriggers.slice(0, 2).join("; ")}.`,
    );
    priorities.push("Review moderate injury triggers.");
  }

  // High cumulative effort
  if (trainingLoad.averagePerceivedEffort >= 7) {
    reasons.push(
      `Average perceived effort is ${trainingLoad.averagePerceivedEffort}/10 — consistently high effort increases fatigue risk.`,
    );
    priorities.push("Reduce average effort intensity.");
  }

  // Multiple hard sessions with insufficient recovery
  if (trainingLoad.hardSessionCount >= 3 && trainingLoad.recoverySessionCount === 0) {
    reasons.push(
      `${trainingLoad.hardSessionCount} hard session(s) with no recovery sessions logged. Your body needs easy days to adapt.`,
    );
    priorities.push("Add recovery sessions between hard efforts.");
  }

  // Increasing volume with injury signals
  if (trainingLoad.trend === "increasing" && injuryRisk.level !== "low") {
    reasons.push(
      "Volume is increasing while injury risk is elevated — this combination deserves caution.",
    );
    priorities.push("Stabilize volume before increasing further.");
  }

  // Consecutive high-effort days
  const consecutiveHighEffort = countConsecutiveHighEffortDays(recentWorkouts);
  if (consecutiveHighEffort >= 2) {
    reasons.push(
      `${consecutiveHighEffort} consecutive days with effort ≥ 7. Back-to-back hard days compound fatigue.`,
    );
    priorities.push("Break the consecutive hard-day streak.");
  }

  // If nothing triggered, no check is needed
  if (reasons.length === 0) {
    return null;
  }

  const paragraphs = [
    "A fatigue and injury check-in was triggered based on your recent training signals.",
    ...reasons,
    buildRecoveryGuidance(stateSummary, profile),
    COACHING_DISCLAIMER,
  ];

  const headline =
    injuryRisk.level === "high"
      ? "⚠️ Fatigue check — injury risk is high"
      : "Fatigue check — elevated training stress";

  const telegramLines = [
    `🔍 ${headline}`,
    reasons[0]!.slice(0, 200),
    "How are you feeling? Consider an easy day or rest if anything feels off.",
  ];
  const telegramMessage = truncateForTelegram(telegramLines.join("\n"));

  return {
    workflow: "fatigue-check",
    generatedAt: new Date().toISOString(),
    headline,
    bodyParagraphs: paragraphs,
    telegramMessage,
    requiresApproval: false,
    approvalReason: null,
    risk: injuryRisk.level === "high" ? "high" : "medium",
    drivingPriorities: priorities,
  };
}

function countConsecutiveHighEffortDays(workouts: CompletedWorkout[]): number {
  const sorted = [...workouts]
    .filter((w) => w.perceivedEffort >= 7)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) return sorted.length;

  let maxConsecutive = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(sorted[i - 1]!.date);
    const currDate = new Date(sorted[i]!.date);
    const daysBetween = Math.round(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysBetween <= 1) {
      current += 1;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 1;
    }
  }
  return maxConsecutive;
}

function buildRecoveryGuidance(
  summary: AthleteStateSummary,
  profile: AthleteProfile,
): string {
  const suggestions: string[] = [];

  if (summary.injuryRisk.level === "high") {
    suggestions.push("Consider taking a full rest day or a very short, easy walk.");
    suggestions.push("If any discomfort persists, please consult a healthcare professional.");
  } else {
    suggestions.push("An easy 20–30 minute jog or a walk can help without adding stress.");
  }

  if (summary.trainingLoad.hardSessionCount >= 3) {
    suggestions.push("Limit quality sessions to 1–2 per week until you feel fresher.");
  }

  const constraint = profile.constraints[0];
  if (constraint) {
    suggestions.push(`Remember your constraint: ${constraint}.`);
  }

  return "Recovery guidance: " + suggestions.join(" ");
}
