// ---------------------------------------------------------------------------
// Next-workout suggestion — recommends the next session with risk guardrails
// ---------------------------------------------------------------------------

import type { AthleteProfile, CompletedWorkout, CompletedWorkoutType } from "../types";
import type { AthleteStateSummary } from "../memory/athlete-state";
import type { NextWorkoutSuggestionResult } from "./types";
import { classifySuggestionRisk, COACHING_DISCLAIMER, hasRecentHardSession, truncateForTelegram } from "./guardrails";

type NextWorkoutInput = {
  recentWorkouts: CompletedWorkout[];
  stateSummary: AthleteStateSummary;
  profile: AthleteProfile;
};

type WorkoutSuggestion = {
  type: CompletedWorkoutType;
  distanceKm: number;
  description: string;
  rationale: string;
};

export function generateNextWorkoutSuggestion({
  recentWorkouts,
  stateSummary,
  profile,
}: NextWorkoutInput): NextWorkoutSuggestionResult {
  const suggestion = pickNextWorkout(recentWorkouts, stateSummary, profile);
  const avgDistance = computeAverageDistance(recentWorkouts);

  const riskClassification = classifySuggestionRisk({
    suggestedWorkoutType: suggestion.type,
    distanceRatioToRecent: avgDistance > 0 ? suggestion.distanceKm / avgDistance : undefined,
    injuryRisk: stateSummary.injuryRisk.level,
    hardSessionCount: stateSummary.trainingLoad.hardSessionCount,
    hardSessionWithin48h: hasRecentHardSession(recentWorkouts, 48),
  });

  const paragraphs: string[] = [
    `Suggested next session: **${suggestion.type}** — ${suggestion.distanceKm} km.`,
    suggestion.description,
    `Rationale: ${suggestion.rationale}`,
  ];

  const priorities: string[] = [];

  if (riskClassification.requiresApproval) {
    paragraphs.push(
      `⚠️ This suggestion is flagged as ${riskClassification.risk} risk: ${riskClassification.reason}`,
    );
    paragraphs.push(
      "Please confirm you're comfortable with this before proceeding. You can always swap to an easy/recovery session instead.",
    );
    priorities.push("Get athlete approval for elevated-risk suggestion.");
  }

  if (stateSummary.injuryRisk.level !== "low") {
    paragraphs.push(COACHING_DISCLAIMER);
    priorities.push("Monitor injury flags.");
  }

  // Goal connection
  const primaryGoal = stateSummary.goalProgress[0];
  if (primaryGoal) {
    priorities.push(`Support goal: ${primaryGoal.goalName} (${primaryGoal.readiness}).`);
  }

  const headline = `Next up: ${suggestion.type} — ${suggestion.distanceKm} km`;

  // Telegram message
  const telegramLines = [
    `🏃 ${headline}`,
    suggestion.description.slice(0, 200),
  ];
  if (riskClassification.requiresApproval) {
    telegramLines.push(`⚠️ Needs your OK — ${riskClassification.reason.slice(0, 150)}`);
  }
  const telegramMessage = truncateForTelegram(telegramLines.join("\n"));

  return {
    workflow: "next-workout-suggestion",
    generatedAt: new Date().toISOString(),
    headline,
    bodyParagraphs: paragraphs,
    telegramMessage,
    requiresApproval: riskClassification.requiresApproval,
    approvalReason: riskClassification.requiresApproval ? riskClassification.reason : null,
    risk: riskClassification.risk,
    drivingPriorities:
      priorities.length > 0 ? priorities : ["Routine next-session suggestion."],
  };
}

function pickNextWorkout(
  recentWorkouts: CompletedWorkout[],
  summary: AthleteStateSummary,
  profile: AthleteProfile,
): WorkoutSuggestion {
  const { injuryRisk, trainingLoad } = summary;
  const lastWorkout = [...recentWorkouts].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];

  const avgDistance = computeAverageDistance(recentWorkouts);
  const baseEasyDistance = avgDistance > 0 ? Math.round(avgDistance * 10) / 10 : 6;

  // High injury risk → always recovery
  if (injuryRisk.level === "high") {
    return {
      type: "recovery",
      distanceKm: Math.min(baseEasyDistance * 0.6, 5),
      description: "A short, very easy recovery run or walk. Keep effort minimal.",
      rationale:
        "Injury risk is high — the priority is letting your body recover before adding any meaningful stress.",
    };
  }

  // Recent hard session → easy day
  if (lastWorkout && lastWorkout.perceivedEffort >= 7) {
    return {
      type: "easy",
      distanceKm: Math.round(baseEasyDistance * 0.85 * 10) / 10,
      description: "An easy aerobic run at conversational pace. No pushing.",
      rationale:
        "Your last session was hard — an easy day helps your body absorb the training stimulus.",
    };
  }

  // Too many hard sessions already → easy or recovery
  if (trainingLoad.hardSessionCount >= 3) {
    return {
      type: "easy",
      distanceKm: baseEasyDistance,
      description: "Easy aerobic running. Save quality for next week.",
      rationale:
        "You've already had multiple hard sessions this period. More easy volume is the best investment right now.",
    };
  }

  // Check if it's the preferred long-run day
  const todayDayName = getDayName();
  if (
    profile.preferredLongRunDay.toLowerCase() === todayDayName.toLowerCase() &&
    injuryRisk.level === "low"
  ) {
    const longDistance = Math.round(baseEasyDistance * 1.5 * 10) / 10;
    return {
      type: "long",
      distanceKm: Math.max(longDistance, 12),
      description: `It's ${profile.preferredLongRunDay} — a good day for your long run. Keep effort conversational throughout.`,
      rationale:
        "This is your preferred long-run day and your body is ready for the volume.",
    };
  }

  // No hard sessions and we have room → suggest a quality session
  if (
    trainingLoad.hardSessionCount <= 1 &&
    injuryRisk.level === "low" &&
    recentWorkouts.length >= 2
  ) {
    return {
      type: "tempo",
      distanceKm: Math.round(baseEasyDistance * 0.9 * 10) / 10,
      description:
        "A tempo run with 15–20 minutes at comfortably hard pace after a warm-up. Back off if anything feels off.",
      rationale:
        "You have room for a quality session. Tempo work improves threshold and is well-supported by your current load.",
    };
  }

  // Default → easy
  return {
    type: "easy",
    distanceKm: baseEasyDistance,
    description: "An easy aerobic run. Enjoy the miles at a relaxed pace.",
    rationale:
      "Easy running builds your aerobic base and keeps you consistent without adding unnecessary stress.",
  };
}

function computeAverageDistance(workouts: CompletedWorkout[]): number {
  if (workouts.length === 0) return 0;
  const total = workouts.reduce((sum, w) => sum + w.distanceKm, 0);
  return Math.round((total / workouts.length) * 10) / 10;
}

function getDayName(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}
