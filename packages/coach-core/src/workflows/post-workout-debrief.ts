// ---------------------------------------------------------------------------
// Post-workout debrief — generates a coaching debrief after a workout
// ---------------------------------------------------------------------------

import type { AthleteProfile, CompletedWorkout } from "../types";
import type { AthleteStateSummary } from "../memory/athlete-state";
import type { PostWorkoutDebriefResult } from "./types";
import { COACHING_DISCLAIMER, truncateForTelegram } from "./guardrails";

type PostWorkoutDebriefInput = {
  workout: CompletedWorkout;
  stateSummary: AthleteStateSummary;
  profile: AthleteProfile;
};

export function generatePostWorkoutDebrief({
  workout,
  stateSummary,
  profile,
}: PostWorkoutDebriefInput): PostWorkoutDebriefResult {
  const paragraphs: string[] = [];
  const priorities: string[] = [];

  // Observation paragraph
  const paceMinKm =
    workout.distanceKm > 0
      ? Math.round(workout.durationMinutes / workout.distanceKm * 10) / 10
      : null;

  const paceNote = paceMinKm ? ` at roughly ${paceMinKm} min/km` : "";
  paragraphs.push(
    `You completed a ${workout.type} run of ${workout.distanceKm} km in ${workout.durationMinutes} minutes${paceNote}. Effort: ${workout.perceivedEffort}/10.`,
  );

  // Positive observation
  if (workout.perceivedEffort <= 5 && ["easy", "recovery"].includes(workout.type)) {
    paragraphs.push(
      "Nice and controlled — keeping easy days genuinely easy is one of the best things you can do for consistency.",
    );
  } else if (workout.type === "long" && workout.perceivedEffort <= 6) {
    paragraphs.push(
      "Good discipline on the long run. Keeping the effort moderate here builds endurance without digging a recovery hole.",
    );
  } else if (workout.type === "tempo" && workout.perceivedEffort >= 6 && workout.perceivedEffort <= 8) {
    paragraphs.push(
      "Solid tempo effort. That controlled discomfort is exactly the stimulus you're looking for.",
    );
  } else if (workout.type === "interval") {
    paragraphs.push(
      "Interval work done. Make sure the next session gives your legs time to absorb the stimulus.",
    );
  }

  // Concern flags
  const concerns: string[] = [];

  if (workout.perceivedEffort >= 8) {
    concerns.push("Effort was high — pay extra attention to recovery over the next 24–48 hours.");
    priorities.push("Recovery after high-effort session.");
  }

  if (stateSummary.injuryRisk.level !== "low") {
    const flagSummary =
      stateSummary.injuryRisk.activeFlags.length > 0
        ? ` Active flags: ${stateSummary.injuryRisk.activeFlags.slice(0, 2).join("; ")}.`
        : "";
    concerns.push(
      `Your injury risk is currently ${stateSummary.injuryRisk.level}.${flagSummary} Be attentive to any new discomfort.`,
    );
    priorities.push("Monitor injury flags.");
  }

  const injuryPattern = /\b(pain|ache|sore|tight|strain|twinge|hurt)\b/i;
  if (injuryPattern.test(workout.summary)) {
    concerns.push(
      "Your workout notes mention possible discomfort — if it persists, consider scaling back and seeking professional guidance.",
    );
    priorities.push("Address discomfort signal in workout notes.");
  }

  if (concerns.length > 0) {
    paragraphs.push(concerns.join(" "));
  }

  // Goal connection
  const primaryGoal = stateSummary.goalProgress[0];
  if (primaryGoal) {
    const daysLabel =
      primaryGoal.daysUntilTarget !== null && primaryGoal.daysUntilTarget > 0
        ? `${primaryGoal.daysUntilTarget} days out`
        : "target approaching";
    paragraphs.push(
      `Goal context: "${primaryGoal.goalName}" is ${daysLabel} (${primaryGoal.readiness}). Today's session ${workout.perceivedEffort <= 6 ? "supports" : "adds stimulus toward"} that goal.`,
    );
    priorities.push(`Support primary goal: ${primaryGoal.goalName}.`);
  }

  // Headline
  const effortLabel =
    workout.perceivedEffort >= 8 ? "tough" : workout.perceivedEffort >= 6 ? "solid" : "easy";
  const headline = `${effortLabel.charAt(0).toUpperCase() + effortLabel.slice(1)} ${workout.type} — ${workout.distanceKm} km done`;

  // Telegram message — concise, no sensitive data
  const telegramParts = [
    `✅ ${headline}.`,
  ];
  if (concerns.length > 0) {
    telegramParts.push("⚠️ " + concerns[0]!.slice(0, 200));
  }
  if (workout.perceivedEffort <= 5) {
    telegramParts.push("Keep it rolling! 🏃");
  }
  const telegramMessage = truncateForTelegram(telegramParts.join(" "));

  return {
    workflow: "post-workout-debrief",
    generatedAt: new Date().toISOString(),
    headline,
    bodyParagraphs: paragraphs,
    telegramMessage,
    requiresApproval: false,
    approvalReason: null,
    risk: concerns.length > 0 ? "medium" : "low",
    drivingPriorities: priorities.length > 0 ? priorities : ["Routine post-workout check-in."],
  };
}
