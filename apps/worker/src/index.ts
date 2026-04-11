// ---------------------------------------------------------------------------
// Coachin'Claw — background worker
//
// Responsibilities:
//   - Validate required environment variables at startup.
//   - Run the proactive coaching scheduler with workflow-driven nudges.
//
// The scheduler uses coaching workflows (post-workout debrief, weekly review,
// fatigue check, next-workout suggestion) to build contextual check-in
// messages instead of generic time-based nudges.
//
// All outbound messages are constrained to OUTBOUND_MAX_CHARS (concise nudges
// only, per the messaging constraint policy). No health data is ever sent.
// ---------------------------------------------------------------------------

import {
  buildAthleteStateSummary,
  demoAthleteProfile,
  demoCompletedWorkouts,
  demoGoals,
  demoMemories,
  evaluateFatigueCheck,
  generateNextWorkoutSuggestion,
  generatePostWorkoutDebrief,
  generateWeeklyReview,
  type WorkflowResult,
} from "@coachinclaw/coach-core";
import {
  generateCoachingWorkflowForAthlete,
  persistOutboundCoachMessage,
} from "@coachinclaw/db";
import {
  createTelegramClient,
  type TelegramClient,
  validateEnv,
  workerEnvSpecs,
  requireEnvVar,
} from "@coachinclaw/integrations";

// ---------------------------------------------------------------------------
// Startup env validation
// ---------------------------------------------------------------------------

let demoMode = false;
try {
  validateEnv(workerEnvSpecs);
} catch (err) {
  const error = err as { missingKeys?: string[]; message?: string };
  console.warn(
    "[worker] env validation warning — running in demo mode (no real secrets):",
    error.missingKeys ?? error.message,
  );
  demoMode = true;
}

// ---------------------------------------------------------------------------
// Coaching workflow–driven nudges
// ---------------------------------------------------------------------------

/**
 * Selects the most relevant coaching workflow to run based on the current
 * athlete state and time of day, then returns the Telegram message.
 *
 * Priority order:
 * 1. Fatigue/injury check — if signals are elevated, this takes precedence.
 * 2. Post-workout debrief — if there's a recent workout to discuss.
 * 3. Weekly review — on the configured review cadence.
 * 4. Next-workout suggestion — default proactive nudge.
 */
function selectDemoCoachingNudge(): WorkflowResult {
  const stateSummary = buildAthleteStateSummary({
    profile: demoAthleteProfile,
    goals: demoGoals,
    memories: demoMemories,
    recentWorkouts: demoCompletedWorkouts,
  });

  // 1. Fatigue/injury check takes priority
  const fatigueResult = evaluateFatigueCheck({
    recentWorkouts: demoCompletedWorkouts,
    stateSummary,
    profile: demoAthleteProfile,
  });
  if (fatigueResult) return fatigueResult;

  // 2. Post-workout debrief for the most recent workout
  const hour = new Date().getHours();
  const latestWorkout = [...demoCompletedWorkouts].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];

  if (latestWorkout && hour >= 16) {
    return generatePostWorkoutDebrief({
      workout: latestWorkout,
      stateSummary,
      profile: demoAthleteProfile,
    });
  }

  // 3. Weekly review on mornings
  if (hour < 12) {
    return generateWeeklyReview({
      recentWorkouts: demoCompletedWorkouts,
      stateSummary,
      profile: demoAthleteProfile,
    });
  }

  // 4. Next-workout suggestion as the default
  return generateNextWorkoutSuggestion({
    recentWorkouts: demoCompletedWorkouts,
    stateSummary,
    profile: demoAthleteProfile,
  });
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

async function sendCheckin(client: TelegramClient, chatId: string): Promise<void> {
  const generated = await generateCoachingWorkflowForAthlete();
  const result = generated.result;
  const sendResult = await client.sendMessage(chatId, result.telegramMessage);

  if (sendResult.ok) {
    await persistOutboundCoachMessage({
      athleteId: generated.athleteId,
      channel: "telegram",
      externalMessageId: String(sendResult.messageId),
      body: result.telegramMessage,
      metadata: {
        workflow: result.workflow,
        risk: result.risk,
        requiresApproval: result.requiresApproval,
        approvalReason: result.approvalReason,
      },
    });

    console.log(
      `[worker] ${result.workflow} sent: message_id=${sendResult.messageId}, risk=${result.risk}, approval=${result.requiresApproval}`,
    );
  } else if (sendResult.rateLimited) {
    console.warn(
      `[worker] ${result.workflow} rate-limited: retry_after_ms=${sendResult.retryAfterMs ?? "unknown"}`,
    );
  } else {
    console.error(`[worker] ${result.workflow} failed: ${sendResult.error}`);
  }
}

async function runCheckinScheduler(): Promise<void> {
  const token = requireEnvVar("TELEGRAM_BOT_TOKEN");
  const chatId = requireEnvVar("TELEGRAM_CHAT_ID");
  const intervalHours = Math.max(
    1,
    parseInt(process.env.CHECKIN_INTERVAL_HOURS ?? "24", 10),
  );
  const intervalMs = intervalHours * 60 * 60 * 1_000;

  const client = createTelegramClient(token);

  // Confirm the bot token is valid before scheduling.
  const alive = await client.isAlive();
  if (!alive) {
    console.error("[worker] Telegram bot token appears invalid — scheduler aborted.");
    return;
  }

  console.log(
    `[worker] coaching scheduler started: interval=${intervalHours}h, chat=${chatId}`,
  );

  // Send an immediate check-in on startup, then on the configured interval.
  await sendCheckin(client, chatId);

  setInterval(() => {
    sendCheckin(client, chatId).catch((err: unknown) => {
      console.error("[worker] unexpected scheduler error:", err);
    });
  }, intervalMs);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (demoMode) {
  // In demo mode, preview the coaching workflow output to confirm behavior.
  const nudge = selectDemoCoachingNudge();
  console.log(
    JSON.stringify(
      {
        startup: "Coachin'Claw worker booted (demo mode)",
        note: "Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET, and MODEL_PROVIDER_API_KEY to enable the real scheduler.",
        previewWorkflow: nudge.workflow,
        previewHeadline: nudge.headline,
        previewTelegram: nudge.telegramMessage,
        previewRisk: nudge.risk,
        previewRequiresApproval: nudge.requiresApproval,
      },
      null,
      2,
    ),
  );
} else {
  runCheckinScheduler().catch((err: unknown) => {
    console.error("[worker] fatal scheduler error:", err);
    process.exit(1);
  });
}
