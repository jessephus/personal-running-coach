// ---------------------------------------------------------------------------
// Personal Running Coach — background worker
//
// Responsibilities:
//   - Validate required environment variables at startup.
//   - Run the proactive Telegram check-in scheduler.
//
// The scheduler sends time-appropriate nudges to the configured Telegram chat
// at a configurable interval (CHECKIN_INTERVAL_HOURS, default 24).
//
// All outbound messages are constrained to OUTBOUND_MAX_CHARS (concise nudges
// only, per the messaging constraint policy). No health data is ever sent.
// ---------------------------------------------------------------------------

import {
  createTelegramClient,
  type TelegramClient,
  validateEnv,
  workerEnvSpecs,
  requireEnvVar,
} from "@personal-running-coach/integrations";

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
// Nudge content
// ---------------------------------------------------------------------------

const MORNING_NUDGE = "Good morning! How are you feeling today? Any runs planned? 🏃";
const AFTERNOON_NUDGE =
  "Afternoon check-in: how's your energy? Did you get a workout in? 💪";
const EVENING_NUDGE =
  "Evening check-in: how did your day go? Any training to log? 🌙";

/**
 * Builds a short, time-appropriate nudge message.
 *
 * Messages are well under OUTBOUND_MAX_CHARS — no health data, no verbose
 * analysis, no memory dumps (per messaging constraint policy).
 */
function buildCheckinNudge(): string {
  const hour = new Date().getHours();
  if (hour < 12) return MORNING_NUDGE;
  if (hour < 17) return AFTERNOON_NUDGE;
  return EVENING_NUDGE;
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

async function sendCheckin(client: TelegramClient, chatId: string): Promise<void> {
  const nudge = buildCheckinNudge();
  const result = await client.sendMessage(chatId, nudge);

  if (result.ok) {
    console.log(`[worker] check-in sent: message_id=${result.messageId}`);
  } else if (result.rateLimited) {
    console.warn(
      `[worker] check-in rate-limited: retry_after_ms=${result.retryAfterMs ?? "unknown"}`,
    );
  } else {
    console.error(`[worker] check-in failed: ${result.error}`);
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
    `[worker] check-in scheduler started: interval=${intervalHours}h, chat=${chatId}`,
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
  console.log(
    JSON.stringify(
      {
        startup: "personal-running-coach worker booted (demo mode)",
        note: "Set TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET, and MODEL_PROVIDER_API_KEY to enable the real scheduler.",
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
