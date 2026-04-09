// ---------------------------------------------------------------------------
// Coaching workflow types — shared output shapes for all workflow functions
// ---------------------------------------------------------------------------

export type SuggestionRisk = "low" | "medium" | "high";

export type WorkflowChannel = "telegram" | "dashboard";

/**
 * Every coaching workflow produces a WorkflowResult.
 * The result carries structured content plus delivery metadata so the caller
 * (API, dashboard, or worker) can decide how to render or send it.
 */
export type WorkflowResult<T extends string = string> = {
  workflow: T;
  generatedAt: string;
  /** Short headline suitable for Telegram or a notification. */
  headline: string;
  /** Structured body paragraphs for the dashboard view. */
  bodyParagraphs: string[];
  /** One-liner safe for Telegram delivery (≤500 chars, no sensitive data). */
  telegramMessage: string;
  /** If true the suggestion involves elevated risk and needs explicit approval. */
  requiresApproval: boolean;
  /** Why the system flagged (or did not flag) this for approval. */
  approvalReason: string | null;
  /** Overall risk classification of the advice in this result. */
  risk: SuggestionRisk;
  /** Coach priorities that drove this result. */
  drivingPriorities: string[];
};

export type PostWorkoutDebriefResult = WorkflowResult<"post-workout-debrief">;
export type WeeklyReviewResult = WorkflowResult<"weekly-review">;
export type FatigueCheckResult = WorkflowResult<"fatigue-check">;
export type NextWorkoutSuggestionResult = WorkflowResult<"next-workout-suggestion">;
