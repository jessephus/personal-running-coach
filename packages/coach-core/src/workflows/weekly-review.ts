// ---------------------------------------------------------------------------
// Weekly review — summarizes the past week and suggests focus for the next
// ---------------------------------------------------------------------------

import type { AthleteProfile, CompletedWorkout } from "../types";
import type { AthleteStateSummary } from "../memory/athlete-state";
import type { WeeklyReviewResult } from "./types";
import { COACHING_DISCLAIMER, truncateForTelegram } from "./guardrails";

type WeeklyReviewInput = {
  recentWorkouts: CompletedWorkout[];
  stateSummary: AthleteStateSummary;
  profile: AthleteProfile;
};

export function generateWeeklyReview({
  recentWorkouts,
  stateSummary,
  profile,
}: WeeklyReviewInput): WeeklyReviewResult {
  const { trainingLoad, injuryRisk, goalProgress } = stateSummary;
  const paragraphs: string[] = [];
  const priorities: string[] = [];

  // Volume summary
  const sessionCount = recentWorkouts.length;
  const typeBreakdown = buildTypeBreakdown(recentWorkouts);
  paragraphs.push(
    `This week: ${sessionCount} session(s) covering ${trainingLoad.weeklyDistanceKm} km in ${trainingLoad.weeklyDurationMinutes} minutes. Average effort: ${trainingLoad.averagePerceivedEffort}/10. ${typeBreakdown}`,
  );

  // Trend observation
  if (trainingLoad.trend === "increasing") {
    paragraphs.push(
      "Volume is trending up. Make sure the increase is gradual — a sustained 10% weekly bump is a reasonable ceiling for most runners.",
    );
    priorities.push("Monitor volume increase rate.");
  } else if (trainingLoad.trend === "decreasing") {
    paragraphs.push(
      "Volume dropped compared to the recent pattern. If this is intentional recovery, great. If not, consider what's getting in the way.",
    );
    priorities.push("Understand volume dip.");
  } else if (trainingLoad.trend === "stable") {
    paragraphs.push(
      "Volume has been steady. Consistency is the single best predictor of long-term progress.",
    );
  }

  // Hard-session balance
  if (trainingLoad.hardSessionCount >= 3) {
    paragraphs.push(
      `You logged ${trainingLoad.hardSessionCount} hard session(s) this week. Most athletes do best with 2–3 quality sessions and the rest easy. Consider whether you're recovering enough between efforts.`,
    );
    priorities.push("Evaluate hard-session frequency.");
  } else if (trainingLoad.hardSessionCount === 0 && sessionCount >= 3) {
    paragraphs.push(
      "No sessions above effort 7 this week. If you're in a recovery phase, that's fine. Otherwise, one quality session per week keeps the body adapting.",
    );
  }

  // Recovery balance
  if (trainingLoad.recoverySessionCount === 0 && sessionCount >= 4) {
    paragraphs.push(
      "No recovery-paced sessions logged. Even one easy or recovery day helps absorption and reduces injury risk.",
    );
    priorities.push("Add at least one recovery session.");
  }

  // Injury risk
  if (injuryRisk.level === "high") {
    paragraphs.push(
      `⚠️ Injury risk is high. Active flags: ${injuryRisk.activeFlags.slice(0, 3).join("; ")}. Prioritize recovery and consider reducing intensity next week. ${COACHING_DISCLAIMER}`,
    );
    priorities.push("Reduce load due to high injury risk.");
  } else if (injuryRisk.level === "moderate") {
    paragraphs.push(
      `Injury risk is moderate. Keep an eye on: ${injuryRisk.activeFlags.slice(0, 2).join("; ")}. ${COACHING_DISCLAIMER}`,
    );
    priorities.push("Monitor injury flags.");
  }

  // Goal progress
  for (const goal of goalProgress.slice(0, 2)) {
    if (goal.readiness === "at-risk") {
      paragraphs.push(
        `Goal "${goal.goalName}" is at risk${goal.daysUntilTarget !== null ? ` with ${goal.daysUntilTarget} day(s) remaining` : ""}. Consider whether the current training direction supports it.`,
      );
      priorities.push(`Address at-risk goal: ${goal.goalName}.`);
    } else if (goal.readiness === "needs-attention") {
      paragraphs.push(
        `Goal "${goal.goalName}" needs attention. You're not off track yet, but the trend should shift soon.`,
      );
      priorities.push(`Attend to goal: ${goal.goalName}.`);
    }
  }

  // Next-week focus
  const nextWeekFocus = deriveNextWeekFocus(stateSummary, profile, recentWorkouts);
  paragraphs.push(`Suggested focus for next week: ${nextWeekFocus}`);

  // Headline
  const riskLabel = injuryRisk.level !== "low" ? ` · injury risk ${injuryRisk.level}` : "";
  const headline = `Week in review — ${trainingLoad.weeklyDistanceKm} km across ${sessionCount} sessions${riskLabel}`;

  // Telegram message
  const telegramLines = [
    `📊 ${headline}`,
    `Avg effort: ${trainingLoad.averagePerceivedEffort}/10, trend: ${trainingLoad.trend}.`,
  ];
  if (injuryRisk.level !== "low") {
    telegramLines.push(`⚠️ Injury risk: ${injuryRisk.level}.`);
  }
  telegramLines.push(`Focus: ${nextWeekFocus.slice(0, 120)}`);

  const telegramMessage = truncateForTelegram(telegramLines.join("\n"));

  return {
    workflow: "weekly-review",
    generatedAt: new Date().toISOString(),
    headline,
    bodyParagraphs: paragraphs,
    telegramMessage,
    requiresApproval: false,
    approvalReason: null,
    risk: injuryRisk.level === "high" ? "high" : injuryRisk.level === "moderate" ? "medium" : "low",
    drivingPriorities: priorities.length > 0 ? priorities : ["Routine weekly review."],
  };
}

function buildTypeBreakdown(workouts: CompletedWorkout[]): string {
  const counts = new Map<string, number>();
  for (const w of workouts) {
    counts.set(w.type, (counts.get(w.type) ?? 0) + 1);
  }
  if (counts.size === 0) return "No sessions logged.";
  return (
    "Mix: " +
    Array.from(counts.entries())
      .map(([type, count]) => `${count} ${type}`)
      .join(", ") +
    "."
  );
}

function deriveNextWeekFocus(
  summary: AthleteStateSummary,
  profile: AthleteProfile,
  recentWorkouts: CompletedWorkout[],
): string {
  if (summary.injuryRisk.level === "high") {
    return "Prioritize recovery. Reduce volume and avoid intensity until discomfort resolves. Seek professional guidance if symptoms persist.";
  }

  if (summary.trainingLoad.hardSessionCount >= 3) {
    return "Ease back on intensity. Aim for mostly easy running with at most one quality session.";
  }

  if (summary.trainingLoad.trend === "decreasing" && summary.trainingLoad.weeklyDistanceKm < 15) {
    return "Rebuild consistency with 3–4 easy sessions. Volume before intensity.";
  }

  const hasLongRun = recentWorkouts.some((w) => w.type === "long");
  if (!hasLongRun && profile.preferredLongRunDay) {
    return `Add a long run on ${profile.preferredLongRunDay} if you're feeling good. Keep effort conversational.`;
  }

  return "Maintain current rhythm. Keep easy days easy and let one quality session per week provide the stimulus.";
}
