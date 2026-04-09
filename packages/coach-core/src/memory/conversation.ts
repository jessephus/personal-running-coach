// ---------------------------------------------------------------------------
// Conversation thread modeling — message sequencing and windowing helpers
// ---------------------------------------------------------------------------

export type ConversationRole = "athlete" | "coach" | "system";

export type ConversationTurn = {
  id: string;
  role: ConversationRole;
  content: string;
  channel: "telegram" | "dashboard" | "system";
  sentAt: string; // ISO 8601
};

export type ConversationThread = {
  id: string;
  athleteId: string;
  turns: ConversationTurn[];
  startedAt: string;
  lastActivityAt: string;
};

/** A bounded slice of a thread ready for inclusion in a prompt context window. */
export type ThreadWindow = {
  turns: ConversationTurn[];
  totalTurns: number;
  truncated: boolean;
};

type RawMessage = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  channel: "telegram" | "dashboard" | "system";
  bodyPreview: string;
  sentAt: Date | string;
};

/** Build a ConversationThread from raw message rows (e.g., from the db coachMessages table). */
export function buildThreadFromRawMessages(
  athleteId: string,
  messages: RawMessage[],
): ConversationThread {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const turns: ConversationTurn[] = sorted.map((msg) => ({
    id: msg.id,
    role: directionToRole(msg.direction),
    content: msg.bodyPreview,
    channel: msg.channel,
    sentAt: new Date(msg.sentAt).toISOString(),
  }));

  const startedAt =
    turns.length > 0 ? turns[0]!.sentAt : new Date().toISOString();
  const lastActivityAt =
    turns.length > 0 ? turns[turns.length - 1]!.sentAt : startedAt;

  return { id: `thread-${athleteId}`, athleteId, turns, startedAt, lastActivityAt };
}

function directionToRole(direction: "inbound" | "outbound" | "system"): ConversationRole {
  if (direction === "inbound") return "athlete";
  if (direction === "outbound") return "coach";
  return "system";
}

/** Return a bounded window of the most recent turns, suitable for prompt injection. */
export function buildThreadWindow(
  thread: ConversationThread,
  maxTurns: number,
): ThreadWindow {
  const { turns } = thread;
  const totalTurns = turns.length;
  if (totalTurns <= maxTurns) {
    return { turns, totalTurns, truncated: false };
  }
  return { turns: turns.slice(totalTurns - maxTurns), totalTurns, truncated: true };
}

export function getLastAthleteMessage(
  thread: ConversationThread,
): ConversationTurn | undefined {
  return [...thread.turns].reverse().find((t) => t.role === "athlete");
}

export function getLastCoachMessage(
  thread: ConversationThread,
): ConversationTurn | undefined {
  return [...thread.turns].reverse().find((t) => t.role === "coach");
}

/** One-line prose summary of the thread for logging or UI display. */
export function summarizeThread(thread: ConversationThread): string {
  const { turns } = thread;
  if (turns.length === 0) return "No conversation history.";

  const athleteTurns = turns.filter((t) => t.role === "athlete").length;
  const coachTurns = turns.filter((t) => t.role === "coach").length;
  const lastTurn = turns[turns.length - 1]!;
  const lastAthleteMsg = getLastAthleteMessage(thread);

  return [
    `Thread: ${turns.length} message(s) — ${athleteTurns} from athlete, ${coachTurns} from coach.`,
    lastAthleteMsg
      ? `Last athlete message: "${lastAthleteMsg.content.slice(0, 100)}${lastAthleteMsg.content.length > 100 ? "..." : ""}"`
      : null,
    `Last activity: ${lastTurn.sentAt}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** True if the thread has at least one turn within the given hours window. */
export function threadHasRecentActivity(
  thread: ConversationThread,
  withinHours: number,
): boolean {
  if (thread.turns.length === 0) return false;
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return new Date(thread.lastActivityAt).getTime() >= cutoff;
}
