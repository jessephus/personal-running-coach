import {
  buildCoachingContext,
  formatContextForPrompt,
  type ConversationThread,
  getLastAthleteMessage,
  type AthleteStateSummary,
} from "./memory";
import {
  COACHING_DISCLAIMER,
  classifySuggestionRisk,
  hasRecentHardSession,
  truncateForTelegram,
} from "./workflows";
import { reviewPromptForPrivacy, type PromptPrivacyReview } from "./governance";
import type {
  AthleteProfile,
  CoachMemory,
  CoachMemoryCategory,
  CompletedWorkout,
  CompletedWorkoutType,
} from "./types";
import type {
  FatigueCheckResult,
  NextWorkoutSuggestionResult,
  PostWorkoutDebriefResult,
  WeeklyReviewResult,
  WorkflowResult,
} from "./workflows/types";

type StructuredOutputGenerator = {
  generateStructuredOutput<T>(input: {
    schemaName: string;
    schema: Record<string, unknown>;
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxCompletionTokens?: number;
    model?: string;
  }): Promise<T>;
};

type WorkflowName =
  | "post-workout-debrief"
  | "weekly-review"
  | "fatigue-check"
  | "next-workout-suggestion";

type PromptMetadata = {
  promptReview: PromptPrivacyReview;
};

export type GenerateCoachingWorkflowInput = {
  profile: AthleteProfile;
  stateSummary: AthleteStateSummary;
  memories: CoachMemory[];
  recentWorkouts: CompletedWorkout[];
  recentThread?: ConversationThread | null;
  workflow?: WorkflowName;
};

export type GenerateCoachingWorkflowOutput = PromptMetadata & {
  result:
    | FatigueCheckResult
    | NextWorkoutSuggestionResult
    | PostWorkoutDebriefResult
    | WeeklyReviewResult;
};

export type MemoryCandidateDraft = {
  category: CoachMemoryCategory;
  title: string;
  detail: string;
  detailSummary: string;
  confidence: "high" | "medium" | "low";
};

export type ExtractCoachMemoriesInput = {
  profile: AthleteProfile;
  stateSummary: AthleteStateSummary;
  existingMemories: CoachMemory[];
  recentWorkouts: CompletedWorkout[];
  recentThread: ConversationThread;
};

export type ExtractCoachMemoriesOutput = PromptMetadata & {
  memories: MemoryCandidateDraft[];
};

type WorkflowDraft = {
  workflow: WorkflowName;
  headline: string;
  bodyParagraphs: string[];
  telegramMessage: string;
  drivingPriorities: string[];
  suggestedWorkoutType: CompletedWorkoutType | null;
  suggestedDistanceKm: number | null;
};

type MemoryExtractionDraft = {
  memories: Array<{
    category: CoachMemoryCategory;
    title: string;
    detail: string;
    detailSummary: string;
    confidence: "high" | "medium" | "low";
  }>;
};

export class PromptPrivacyError extends Error {
  readonly review: PromptPrivacyReview;

  constructor(review: PromptPrivacyReview) {
    super(
      `Prompt privacy review failed: ${review.violations
        .map((violation) => violation.flagId)
        .join(", ")}`,
    );
    this.name = "PromptPrivacyError";
    this.review = review;
  }
}

const WORKFLOW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "workflow",
    "headline",
    "bodyParagraphs",
    "telegramMessage",
    "drivingPriorities",
    "suggestedWorkoutType",
    "suggestedDistanceKm",
  ],
  properties: {
    workflow: {
      type: "string",
      enum: [
        "post-workout-debrief",
        "weekly-review",
        "fatigue-check",
        "next-workout-suggestion",
      ],
    },
    headline: { type: "string" },
    bodyParagraphs: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    telegramMessage: { type: "string" },
    drivingPriorities: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
    suggestedWorkoutType: {
      type: ["string", "null"],
      enum: ["easy", "tempo", "interval", "long", "recovery", null],
    },
    suggestedDistanceKm: { type: ["number", "null"] },
  },
} as const;

const MEMORY_EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["memories"],
  properties: {
    memories: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "title", "detail", "detailSummary", "confidence"],
        properties: {
          category: {
            type: "string",
            enum: ["goal", "injury", "preference", "pattern"],
          },
          title: { type: "string" },
          detail: { type: "string" },
          detailSummary: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
} as const;

export async function generateCoachingWorkflowWithLlm(
  input: GenerateCoachingWorkflowInput,
  model: StructuredOutputGenerator,
): Promise<GenerateCoachingWorkflowOutput> {
  const safeInput = buildPromptSafeWorkflowInput(input);
  const context = buildCoachingContext({
    profile: safeInput.profile,
    stateSummary: safeInput.stateSummary,
    memories: safeInput.memories,
    recentWorkouts: safeInput.recentWorkouts,
    recentThread: safeInput.recentThread ?? undefined,
  });
  const promptText = [
    buildWorkflowRequestBlock(input.workflow),
    "## Calibration Signals",
    safeInput.calibrationSignals.map((signal) => `- ${signal}`).join("\n"),
    formatContextForPrompt(context),
    buildLatestWorkoutBlock(safeInput.recentWorkouts),
  ]
    .filter(Boolean)
    .join("\n\n");

  const promptReview = reviewPromptForPrivacy(promptText);
  if (!promptReview.passed) {
    throw new PromptPrivacyError(promptReview);
  }

  const draft = await model.generateStructuredOutput<WorkflowDraft>({
    schemaName: input.workflow ? "forced_coaching_workflow" : "auto_coaching_workflow",
    schema: WORKFLOW_SCHEMA,
    systemPrompt: buildWorkflowSystemPrompt(),
    userPrompt: promptText,
    temperature: 0.35,
    maxCompletionTokens: 900,
  });

  const validatedDraft = validateWorkflowDraft(draft, input.workflow);

  return {
    result: finalizeWorkflowResult(validatedDraft, input),
    promptReview,
  };
}

export async function extractCoachMemoriesWithLlm(
  input: ExtractCoachMemoriesInput,
  model: StructuredOutputGenerator,
): Promise<ExtractCoachMemoriesOutput> {
  const safeInput = buildPromptSafeMemoryInput(input);
  const context = buildCoachingContext({
    profile: safeInput.profile,
    stateSummary: safeInput.stateSummary,
    memories: safeInput.existingMemories,
    recentWorkouts: safeInput.recentWorkouts,
    recentThread: safeInput.recentThread,
  });
  const lastAthleteMessage = getLastAthleteMessage(safeInput.recentThread);
  if (!lastAthleteMessage) {
    return {
      memories: [],
      promptReview: {
        passed: true,
        violations: [],
        reviewedAt: new Date().toISOString(),
        promptLengthChars: 0,
      },
    };
  }

  const promptText = [
    "## Objective",
    "Extract only durable coaching memory worth saving for future sessions. Ignore transient chit-chat, one-off scheduling details, and anything already represented in existing memory.",
    "## Existing Memories",
    safeInput.existingMemories.length > 0
      ? safeInput.existingMemories
          .map((memory) => `- [${memory.category}] ${memory.title}: ${memory.detail}`)
          .join("\n")
      : "No existing memory recorded.",
    "## Latest Athlete Message",
    lastAthleteMessage.content,
    formatContextForPrompt(context),
  ].join("\n\n");

  const promptReview = reviewPromptForPrivacy(promptText);
  if (!promptReview.passed) {
    throw new PromptPrivacyError(promptReview);
  }

  const draft = await model.generateStructuredOutput<MemoryExtractionDraft>({
    schemaName: "coach_memory_extraction",
    schema: MEMORY_EXTRACTION_SCHEMA,
    systemPrompt: buildMemorySystemPrompt(),
    userPrompt: promptText,
    temperature: 0.2,
    maxCompletionTokens: 700,
  });

  return {
    memories: validateMemoryExtractionDraft(draft),
    promptReview,
  };
}

function buildWorkflowSystemPrompt(): string {
  return [
    "You are the primary coaching decision engine for a single-athlete running app.",
    "The LLM should do the main reasoning and wording, but deterministic safety guardrails remain authoritative.",
    "Base every statement on the provided context. Do not invent workouts, injuries, goals, or constraints.",
    "When uncertainty remains, acknowledge it plainly instead of pretending confidence.",
    "Keep bodyParagraphs as 2-4 concise plain-text paragraphs.",
    "Keep telegramMessage concise, actionable, and free of detailed medical context.",
    "For next-workout-suggestion you must provide suggestedWorkoutType and suggestedDistanceKm.",
    "For non-next-workout workflows set suggestedWorkoutType and suggestedDistanceKm to null.",
  ].join(" ");
}

function buildMemorySystemPrompt(): string {
  return [
    "You decide what durable athlete information should be saved into long-term coaching memory.",
    "Only keep information likely to matter in future sessions: goals, persistent injury patterns, stable preferences, and meaningful recurring training patterns.",
    "Do not store transient logistics, greetings, secrets, contact info, or detailed medical language.",
    "Use generalized, privacy-minimized wording that is still useful for future coaching.",
    "Return an empty memories array when nothing deserves storage.",
  ].join(" ");
}

function buildWorkflowRequestBlock(workflow: WorkflowName | undefined): string {
  if (workflow) {
    return [
      "## Workflow Request",
      `You must generate a "${workflow}" result.`,
      buildWorkflowDefinition(workflow),
    ].join("\n");
  }

  return [
    "## Workflow Request",
    "Choose the single best workflow for the current moment.",
    buildWorkflowDefinition("fatigue-check"),
    buildWorkflowDefinition("post-workout-debrief"),
    buildWorkflowDefinition("weekly-review"),
    buildWorkflowDefinition("next-workout-suggestion"),
  ].join("\n");
}

function buildWorkflowDefinition(workflow: WorkflowName): string {
  switch (workflow) {
    case "fatigue-check":
      return '- "fatigue-check": use when injury or fatigue signals should drive the conversation more than performance.';
    case "post-workout-debrief":
      return '- "post-workout-debrief": use when the latest completed workout should be reflected on directly.';
    case "weekly-review":
      return '- "weekly-review": use when summarizing the current training week and setting the next focus.';
    case "next-workout-suggestion":
      return '- "next-workout-suggestion": use when the athlete most needs a concrete next-session recommendation.';
  }

  return assertNever(workflow);
}

function buildLatestWorkoutBlock(recentWorkouts: CompletedWorkout[]): string {
  const latestWorkout = getLatestWorkout(recentWorkouts);
  if (!latestWorkout) {
    return "## Latest Workout\nNo recent workout is available.";
  }

  return [
    "## Latest Workout",
    `${latestWorkout.date} [${latestWorkout.type}] ${latestWorkout.distanceKm}km in ${latestWorkout.durationMinutes}min at effort ${latestWorkout.perceivedEffort}/10 — ${latestWorkout.summary}`,
  ].join("\n");
}

function buildPromptSafeWorkflowInput(input: GenerateCoachingWorkflowInput) {
  const calibrationSignals = buildCalibrationSignals(
    input.stateSummary,
    input.recentWorkouts,
    input.profile,
  );

  return {
    profile: sanitizeProfileForPrompt(input.profile),
    stateSummary: sanitizeStateSummaryForPrompt(input.stateSummary),
    memories: input.memories.map(sanitizeMemoryForPrompt),
    recentWorkouts: input.recentWorkouts.map(sanitizeWorkoutForPrompt),
    recentThread: input.recentThread ? sanitizeThreadForPrompt(input.recentThread) : null,
    calibrationSignals,
  };
}

function buildPromptSafeMemoryInput(input: ExtractCoachMemoriesInput) {
  return {
    profile: sanitizeProfileForPrompt(input.profile),
    stateSummary: sanitizeStateSummaryForPrompt(input.stateSummary),
    existingMemories: input.existingMemories.map(sanitizeMemoryForPrompt),
    recentWorkouts: input.recentWorkouts.map(sanitizeWorkoutForPrompt),
    recentThread: sanitizeThreadForPrompt(input.recentThread),
  };
}

function sanitizeProfileForPrompt(profile: AthleteProfile): AthleteProfile {
  return {
    ...profile,
    displayName: "Athlete",
    constraints: profile.constraints.map((constraint) => sanitizeTextForPrompt(constraint)),
    injuryFlags: profile.injuryFlags.map((flag) => sanitizeTextForPrompt(flag)),
  };
}

function sanitizeStateSummaryForPrompt(summary: AthleteStateSummary): AthleteStateSummary {
  return {
    ...summary,
    athleteName: "Athlete",
    injuryRisk: {
      ...summary.injuryRisk,
      activeFlags: summary.injuryRisk.activeFlags.map((flag) => sanitizeTextForPrompt(flag)),
      recentTriggers: summary.injuryRisk.recentTriggers.map((trigger) =>
        sanitizeTextForPrompt(trigger),
      ),
    },
    coachPriorities: summary.coachPriorities.map((priority) => sanitizeTextForPrompt(priority)),
    memoryHighlights: summary.memoryHighlights.map((highlight) => sanitizeTextForPrompt(highlight)),
  };
}

function sanitizeMemoryForPrompt(memory: CoachMemory): CoachMemory {
  return {
    ...memory,
    title: sanitizeTextForPrompt(memory.title),
    detail: sanitizeTextForPrompt(memory.detail),
  };
}

function sanitizeWorkoutForPrompt(workout: CompletedWorkout): CompletedWorkout {
  return {
    ...workout,
    summary: sanitizeTextForPrompt(workout.summary),
  };
}

function sanitizeThreadForPrompt(thread: ConversationThread): ConversationThread {
  return {
    ...thread,
    turns: thread.turns.map((turn) => ({
      ...turn,
      content: sanitizeTextForPrompt(turn.content),
    })),
  };
}

function sanitizeTextForPrompt(value: string): string {
  return truncateLine(
    value
      .replace(/\b(eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36})\b/g, "[redacted credential]")
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[redacted email]")
      .replace(/\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[redacted phone]")
      .replace(
        /\b(diagnosis|prescription|medication|doctor|physician|surgery|MRI|x-ray|fracture|tendonitis|plantar fasciitis)\b/gi,
        "medical reference",
      )
      .replace(
        /\b(sharp pain|chronic pain|inflammation|swelling|torn|rupture|sprain)\b/gi,
        "musculoskeletal issue",
      )
      .trim(),
    240,
  );
}

function finalizeWorkflowResult(
  draft: WorkflowDraft,
  input: GenerateCoachingWorkflowInput,
): GenerateCoachingWorkflowOutput["result"] {
  const generatedAt = new Date().toISOString();
  const bodyParagraphs = finalizeBodyParagraphs(
    draft.bodyParagraphs,
    input.stateSummary.injuryRisk.level !== "low" || draft.workflow === "fatigue-check",
  );
  const telegramMessage = finalizeTelegramMessage(draft.telegramMessage);

  switch (draft.workflow) {
    case "post-workout-debrief": {
      const latestWorkout = getLatestWorkout(input.recentWorkouts);
      const mentionsDiscomfort = latestWorkout
        ? /\b(pain|ache|sore|tight|strain|twinge|hurt)\b/i.test(latestWorkout.summary)
        : false;
      const risk =
        input.stateSummary.injuryRisk.level === "high"
          ? "high"
          : latestWorkout && (latestWorkout.perceivedEffort >= 8 || mentionsDiscomfort)
            ? "medium"
            : input.stateSummary.injuryRisk.level === "moderate"
              ? "medium"
              : "low";

      return {
        workflow: draft.workflow,
        generatedAt,
        headline: draft.headline,
        bodyParagraphs,
        telegramMessage,
        requiresApproval: false,
        approvalReason: null,
        risk,
        drivingPriorities: draft.drivingPriorities,
      };
    }

    case "weekly-review":
      return {
        workflow: draft.workflow,
        generatedAt,
        headline: draft.headline,
        bodyParagraphs,
        telegramMessage,
        requiresApproval: false,
        approvalReason: null,
        risk:
          input.stateSummary.injuryRisk.level === "high"
            ? "high"
            : input.stateSummary.injuryRisk.level === "moderate"
              ? "medium"
              : "low",
        drivingPriorities: draft.drivingPriorities,
      };

    case "fatigue-check":
      return {
        workflow: draft.workflow,
        generatedAt,
        headline: draft.headline,
        bodyParagraphs,
        telegramMessage,
        requiresApproval: false,
        approvalReason: null,
        risk: input.stateSummary.injuryRisk.level === "high" ? "high" : "medium",
        drivingPriorities: draft.drivingPriorities,
      };

    case "next-workout-suggestion": {
      if (!draft.suggestedWorkoutType || draft.suggestedDistanceKm === null) {
        throw new Error(
          "Model output for next-workout-suggestion must include suggestedWorkoutType and suggestedDistanceKm.",
        );
      }

      const averageDistance = computeAverageDistance(input.recentWorkouts);
      const riskClassification = classifySuggestionRisk({
        suggestedWorkoutType: draft.suggestedWorkoutType,
        distanceRatioToRecent:
          averageDistance > 0 ? draft.suggestedDistanceKm / averageDistance : undefined,
        injuryRisk: input.stateSummary.injuryRisk.level,
        hardSessionCount: input.stateSummary.trainingLoad.hardSessionCount,
        hardSessionWithin48h: hasRecentHardSession(input.recentWorkouts, 48),
      });

      const finalParagraphs = [...bodyParagraphs];
      if (riskClassification.requiresApproval) {
        finalParagraphs.push(
          `Please review this before acting: ${riskClassification.reason}`,
        );
      }

      return {
        workflow: draft.workflow,
        generatedAt,
        headline: draft.headline,
        bodyParagraphs: finalParagraphs,
        telegramMessage,
        requiresApproval: riskClassification.requiresApproval,
        approvalReason: riskClassification.requiresApproval ? riskClassification.reason : null,
        risk: riskClassification.risk,
        drivingPriorities: draft.drivingPriorities,
      };
    }
  }

  return assertNever(draft.workflow);
}

function finalizeBodyParagraphs(paragraphs: string[], includeDisclaimer: boolean): string[] {
  const sanitized = paragraphs.map((paragraph) => sanitizeCoachOutputText(paragraph)).filter(Boolean);
  if (!includeDisclaimer) {
    return sanitized;
  }

  if (sanitized.some((paragraph) => paragraph === COACHING_DISCLAIMER)) {
    return sanitized;
  }

  return [...sanitized, COACHING_DISCLAIMER];
}

function finalizeTelegramMessage(message: string): string {
  return truncateForTelegram(sanitizeCoachOutputText(message));
}

function sanitizeCoachOutputText(value: string): string {
  return value
    .replace(
      /\b(diagnosis|prescription|medication|doctor|physician|surgery|MRI|x-ray|fracture|tendonitis|plantar fasciitis)\b/gi,
      "medical issue",
    )
    .replace(
      /\b(sharp pain|chronic pain|inflammation|swelling|torn|rupture|sprain)\b/gi,
      "musculoskeletal issue",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function validateWorkflowDraft(
  draft: WorkflowDraft,
  forcedWorkflow: WorkflowName | undefined,
): WorkflowDraft {
  const allowedWorkflows: WorkflowName[] = [
    "post-workout-debrief",
    "weekly-review",
    "fatigue-check",
    "next-workout-suggestion",
  ];

  if (!allowedWorkflows.includes(draft.workflow)) {
    throw new Error(`Model returned unsupported workflow "${String(draft.workflow)}".`);
  }

  if (forcedWorkflow && draft.workflow !== forcedWorkflow) {
    throw new Error(
      `Model returned workflow "${draft.workflow}" but "${forcedWorkflow}" was required.`,
    );
  }

  if (!draft.headline.trim()) {
    throw new Error("Model returned an empty workflow headline.");
  }

  if (draft.bodyParagraphs.length === 0 || draft.bodyParagraphs.some((paragraph) => !paragraph.trim())) {
    throw new Error("Model returned empty workflow paragraphs.");
  }

  if (draft.drivingPriorities.length === 0 || draft.drivingPriorities.some((priority) => !priority.trim())) {
    throw new Error("Model returned empty workflow priorities.");
  }

  return {
    ...draft,
    headline: draft.headline.trim(),
    bodyParagraphs: draft.bodyParagraphs.map((paragraph) => paragraph.trim()),
    telegramMessage: draft.telegramMessage.trim(),
    drivingPriorities: draft.drivingPriorities.map((priority) => priority.trim()),
  };
}

function validateMemoryExtractionDraft(draft: MemoryExtractionDraft): MemoryCandidateDraft[] {
  return draft.memories
    .map((memory) => ({
      ...memory,
      title: memory.title.trim(),
      detail: sanitizeCoachOutputText(memory.detail),
      detailSummary: sanitizeCoachOutputText(memory.detailSummary),
    }))
    .filter(
      (memory) =>
        memory.title.length > 0 &&
        memory.detail.length > 0 &&
        memory.detailSummary.length > 0,
    );
}

function buildCalibrationSignals(
  stateSummary: AthleteStateSummary,
  recentWorkouts: CompletedWorkout[],
  profile: AthleteProfile,
): string[] {
  const latestWorkout = getLatestWorkout(recentWorkouts);
  const signals = [
    `Current injury risk is ${stateSummary.injuryRisk.level}.`,
    `Current weekly distance is ${stateSummary.trainingLoad.weeklyDistanceKm}km with ${stateSummary.trainingLoad.hardSessionCount} hard session(s).`,
    `Training trend is ${stateSummary.trainingLoad.trend}.`,
  ];

  if (latestWorkout) {
    signals.push(
      `Latest workout was ${latestWorkout.type} on ${latestWorkout.date} at effort ${latestWorkout.perceivedEffort}/10.`,
    );
  }

  if (hasRecentHardSession(recentWorkouts, 48)) {
    signals.push("A hard session occurred within the last 48 hours, so back-to-back intensity should be treated cautiously.");
  }

  if (profile.preferredLongRunDay) {
    signals.push(`The athlete prefers long runs on ${profile.preferredLongRunDay}.`);
  }

  signals.push(
    "Deterministic guardrails will review any next-workout intensity or large distance jump before approval.",
  );

  return signals;
}

function getLatestWorkout(workouts: CompletedWorkout[]): CompletedWorkout | null {
  if (workouts.length === 0) {
    return null;
  }

  return [...workouts].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

function computeAverageDistance(workouts: CompletedWorkout[]): number {
  if (workouts.length === 0) {
    return 0;
  }

  const totalDistance = workouts.reduce((sum, workout) => sum + workout.distanceKm, 0);
  return totalDistance / workouts.length;
}

function truncateLine(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1)}…` : value;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
