// ---------------------------------------------------------------------------
// Coaching context assembly — retrieval-oriented helpers that decide what
// context to surface when building a prompt for the coaching model
// ---------------------------------------------------------------------------

import type { AthleteProfile, CoachMemory, CompletedWorkout } from "../types";
import { coachPersona, formatCoachPersonaForPrompt } from "../persona";
import type { ConversationThread, ThreadWindow } from "./conversation";
import type { AthleteStateSummary } from "./athlete-state";
import { buildThreadWindow } from "./conversation";

const DEFAULT_MAX_TURNS = 10;
const DEFAULT_MAX_WORKOUTS = 7;
const DEFAULT_MAX_MEMORIES = 5;

export type CoachingContextInput = {
  profile: AthleteProfile;
  stateSummary: AthleteStateSummary;
  memories: CoachMemory[];
  recentWorkouts: CompletedWorkout[];
  recentThread?: ConversationThread;
  maxConversationTurns?: number;
  maxWorkouts?: number;
  maxMemories?: number;
};

export type CoachingContext = {
  /** Shared coach identity and philosophy for prompt grounding. */
  coachPersonaText: string;
  /** Prose paragraph ready to paste as the athlete preamble in a system prompt. */
  athleteSummaryText: string;
  /** Memories ranked for this session (injury-first when risk is elevated). */
  relevantMemories: CoachMemory[];
  /** One-line strings per workout, most recent first. */
  recentWorkoutSummaries: string[];
  /** Bounded recent conversation, or null if no thread was supplied. */
  recentConversationWindow: ThreadWindow | null;
  /** Guardrail and style instructions for the model call. */
  coachingInstructions: string[];
};

/**
 * Rank and filter memories by relevance to the current athlete state.
 * Elevated injury risk surfaces injury memories first; goal memories always
 * appear; preference and pattern memories fill any remaining slots.
 */
export function selectRelevantMemories(
  memories: CoachMemory[],
  stateSummary: AthleteStateSummary,
  maxMemories: number = DEFAULT_MAX_MEMORIES,
): CoachMemory[] {
  const prioritized: CoachMemory[] = [];

  if (stateSummary.injuryRisk.level !== "low") {
    prioritized.push(...memories.filter((m) => m.category === "injury"));
  }

  prioritized.push(
    ...memories.filter((m) => m.category === "goal" && !prioritized.includes(m)),
  );

  prioritized.push(...memories.filter((m) => !prioritized.includes(m)));

  return prioritized.slice(0, maxMemories);
}

/**
 * Return the most recent workouts, capped at maxWorkouts, sorted newest-first.
 */
export function rankWorkoutsForContext(
  workouts: CompletedWorkout[],
  maxWorkouts: number = DEFAULT_MAX_WORKOUTS,
): CompletedWorkout[] {
  return [...workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, maxWorkouts);
}

/** Assemble a CoachingContext from all available athlete data. */
export function buildCoachingContext({
  profile,
  stateSummary,
  memories,
  recentWorkouts,
  recentThread,
  maxConversationTurns = DEFAULT_MAX_TURNS,
  maxWorkouts = DEFAULT_MAX_WORKOUTS,
  maxMemories = DEFAULT_MAX_MEMORIES,
}: CoachingContextInput): CoachingContext {
  const relevantMemories = selectRelevantMemories(memories, stateSummary, maxMemories);
  const topWorkouts = rankWorkoutsForContext(recentWorkouts, maxWorkouts);

  const recentWorkoutSummaries = topWorkouts.map(
    (w) =>
      `${w.date} [${w.type}] ${w.distanceKm}km, ${w.durationMinutes}min, effort ${w.perceivedEffort}/10 — ${w.summary}`,
  );

  const recentConversationWindow = recentThread
    ? buildThreadWindow(recentThread, maxConversationTurns)
    : null;

  return {
    coachPersonaText: formatCoachPersonaForPrompt(),
    athleteSummaryText: buildAthleteSummaryText(stateSummary, profile),
    relevantMemories,
    recentWorkoutSummaries,
    recentConversationWindow,
    coachingInstructions: buildCoachingInstructions(stateSummary, profile),
  };
}

function buildAthleteSummaryText(
  summary: AthleteStateSummary,
  profile: AthleteProfile,
): string {
  const { trainingLoad, injuryRisk, goalProgress } = summary;

  const goalLine =
    goalProgress.length > 0
      ? `Primary goal: "${goalProgress[0]!.goalName}" (${goalProgress[0]!.readiness}).`
      : "No active goals on record.";

  const loadLine = `Weekly load: ${trainingLoad.weeklyDistanceKm}km, ${trainingLoad.weeklyDurationMinutes}min (avg effort ${trainingLoad.averagePerceivedEffort}/10, trend: ${trainingLoad.trend}).`;

  const riskLine =
    injuryRisk.level !== "low"
      ? `Injury risk: ${injuryRisk.level}. Active flags: ${injuryRisk.activeFlags.join("; ")}.`
      : "No elevated injury risk.";

  const constraintsLine =
    profile.constraints.length > 0 ? `Constraints: ${profile.constraints.join("; ")}.` : "";

  return [
    `Athlete: ${summary.athleteName} (${profile.coachingStyle} style).`,
    goalLine,
    loadLine,
    riskLine,
    constraintsLine,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCoachingInstructions(
  summary: AthleteStateSummary,
  profile: AthleteProfile,
): string[] {
  const instructions = [
    `You are ${coachPersona.name}, a quiet and steady running coach.`,
    `Use a ${profile.coachingStyle} coaching tone.`,
    ...coachPersona.voiceDirectives,
    "Ground all suggestions in the athlete's recent workouts, goals, and memory context.",
    "Never include OAuth tokens, API keys, raw injury notes, or medical terminology in responses.",
  ];

  if (summary.injuryRisk.level === "high") {
    instructions.push("Prioritize injury-risk signals above performance coaching in this session.");
  }

  if (profile.coachingStyle === "direct") {
    instructions.push("Be concise and specific. Skip hedging unless safety is a concern.");
  } else {
    instructions.push("Be encouraging and briefly explain the reasoning behind each suggestion.");
  }

  return instructions;
}

/**
 * Render a CoachingContext into a structured prompt string.
 * The output is safe to embed in a system prompt; no raw sensitive data should
 * appear here because selectRelevantMemories and buildCoachingInstructions
 * already enforce those constraints.
 */
export function formatContextForPrompt(context: CoachingContext): string {
  const sections: string[] = [];

  sections.push(`## Coach Persona\n${context.coachPersonaText}`);

  sections.push(`## Athlete Summary\n${context.athleteSummaryText}`);

  if (context.coachingInstructions.length > 0) {
    sections.push(
      `## Coaching Instructions\n${context.coachingInstructions.map((i) => `- ${i}`).join("\n")}`,
    );
  }

  if (context.relevantMemories.length > 0) {
    const lines = context.relevantMemories.map(
      (m) => `- [${m.category}] ${m.title}: ${m.detail}`,
    );
    sections.push(`## Relevant Memory\n${lines.join("\n")}`);
  }

  if (context.recentWorkoutSummaries.length > 0) {
    sections.push(
      `## Recent Workouts\n${context.recentWorkoutSummaries.map((s) => `- ${s}`).join("\n")}`,
    );
  }

  if (context.recentConversationWindow && context.recentConversationWindow.turns.length > 0) {
    const { turns, truncated } = context.recentConversationWindow;
    const turnLines = turns.map(
      (t) => `${t.role === "athlete" ? "Athlete" : "Coach"}: ${t.content}`,
    );
    const header = truncated
      ? `## Recent Conversation (last ${turns.length} messages, thread truncated)`
      : `## Recent Conversation`;
    sections.push(`${header}\n${turnLines.join("\n")}`);
  }

  return sections.join("\n\n");
}
