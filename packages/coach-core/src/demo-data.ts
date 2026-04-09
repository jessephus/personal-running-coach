import type {
  AthleteGoal,
  AthleteProfile,
  CoachMemory,
  CompletedWorkout,
  DeferredFeatureSpec,
} from "./types";

export const demoAthleteProfile: AthleteProfile = {
  id: "athlete-demo",
  displayName: "Demo Athlete",
  timezone: "Etc/UTC",
  preferredLongRunDay: "Sunday",
  coachingStyle: "direct",
  constraints: ["No doubles on weekdays", "Friday is usually recovery-focused"],
  injuryFlags: ["Monitor lower-leg tightness after faster sessions"],
};

export const demoGoals: AthleteGoal[] = [
  {
    id: "goal-marathon",
    name: "Target a confident marathon build",
    targetDate: "2026-11-01",
    priority: "A",
    notes: "Keep consistency high and avoid spikes that aggravate known niggles.",
  },
  {
    id: "goal-volume",
    name: "Sustain a healthy weekly base",
    targetDate: "2026-07-01",
    priority: "B",
    notes: "Favor steady mileage over hero workouts.",
  },
];

export const demoCompletedWorkouts: CompletedWorkout[] = [
  {
    id: "workout-1",
    date: "2026-04-07",
    type: "easy",
    distanceKm: 8.4,
    durationMinutes: 46,
    perceivedEffort: 4,
    summary: "Easy aerobic run with stable effort and relaxed cadence.",
    source: "strava",
  },
  {
    id: "workout-2",
    date: "2026-04-08",
    type: "tempo",
    distanceKm: 10.2,
    durationMinutes: 55,
    perceivedEffort: 7,
    summary: "Tempo session finished strong, but some lower-leg tightness showed up late.",
    source: "strava",
  },
  {
    id: "workout-3",
    date: "2026-04-09",
    type: "recovery",
    distanceKm: 6.1,
    durationMinutes: 35,
    perceivedEffort: 3,
    summary: "Short recovery outing after the tempo day.",
    source: "strava",
  },
];

export const demoMemories: CoachMemory[] = [
  {
    id: "memory-1",
    category: "injury",
    title: "Lower-leg flare pattern",
    detail: "Fast running after a low-sleep day tends to trigger lower-leg tightness.",
  },
  {
    id: "memory-2",
    category: "preference",
    title: "Long-run preference",
    detail: "Sunday long runs work best, especially when Saturday stays easy.",
  },
  {
    id: "memory-3",
    category: "pattern",
    title: "Weekly load response",
    detail: "Consistency improves when sessions are previewed the night before.",
  },
];

export const demoDeferredFeatures: DeferredFeatureSpec[] = [
  {
    slug: "auto-plan-editing",
    title: "Auto-edit external training plans",
    whyDeferred:
      "The MVP should earn trust with suggestions first instead of writing back changes into third-party systems automatically.",
    futureApproach:
      "Support explicit approval workflows first, then carefully introduce low-risk automation once audit trails and rollback paths are mature.",
    securityNotes: [
      "Any write-back token must be encrypted and scoped as narrowly as possible.",
      "Every automated change should produce an auditable record and a user-visible explanation.",
    ],
    acceptanceCriteria: [
      "Approved plan changes can be pushed to the target system safely.",
      "The athlete can review exactly what changed and revert when needed.",
    ],
    openQuestions: [
      "Which plan source should receive edits first?",
      "What guardrails define a low-risk plan change versus a human-review-only change?",
    ],
  },
  {
    slug: "garmin-ingestion",
    title: "Garmin ingestion",
    whyDeferred:
      "Garmin access is harder to automate safely and cleanly than Strava, so it should not block the first release.",
    futureApproach:
      "Start with a supported API or a user-mediated import path that keeps raw files and tokens protected.",
    securityNotes: [
      "Encrypt any stored Garmin tokens or raw files.",
      "Do not rely on scraping or unsupported session reuse.",
    ],
    acceptanceCriteria: [
      "A user can connect Garmin or import Garmin workout files.",
      "Garmin workouts normalize into the same canonical workout model as Strava data.",
    ],
    openQuestions: [
      "What official Garmin access is realistically available for a personal app?",
      "Is manual FIT import an acceptable intermediate step after MVP?",
    ],
  },
  {
    slug: "runna-sync",
    title: "Runna plan sync",
    whyDeferred:
      "The available ICS-style path does not contain enough structured workout detail to be valuable for MVP coaching decisions.",
    futureApproach:
      "Revisit only if a richer supported or acceptable unofficial integration path appears.",
    securityNotes: [
      "Be careful with any unofficial API path; review terms and token handling before implementation.",
      "Avoid storing brittle scraped credentials or sessions.",
    ],
    acceptanceCriteria: [
      "Imported planned workouts preserve enough detail to compare structure, intensity, and intent.",
      "The sync path survives normal plan edits without manual repair.",
    ],
    openQuestions: [
      "Is there a supported richer export path beyond ICS?",
      "Would a user-mediated export still be too shallow to justify the complexity?",
    ],
  },
  {
    slug: "planned-vs-actual",
    title: "Detailed planned-vs-actual analysis",
    whyDeferred:
      "The MVP can coach effectively from completed workouts, memories, and goals even without a reliable third-party planned-workout source.",
    futureApproach:
      "Introduce plan-aware analysis only after detailed plan data is trustworthy enough to support comparisons.",
    securityNotes: [
      "Treat plan metadata as sensitive training information if it reveals health or injury context.",
      "Do not expose plan deltas through low-trust messaging channels.",
    ],
    acceptanceCriteria: [
      "The system can explain how an actual workout differed from the planned stimulus.",
      "Coach recommendations cite plan context accurately instead of guessing intent.",
    ],
    openQuestions: [
      "Which plan source is trustworthy enough to drive comparisons?",
      "How should the UI explain mismatches when plan data is missing or stale?",
    ],
  },
  {
    slug: "multi-athlete-support",
    title: "Multi-athlete support",
    whyDeferred:
      "The MVP is intentionally single-user so security, data modeling, and coaching behavior can be tuned without tenant complexity.",
    futureApproach:
      "Add tenant isolation, role-aware permissions, and athlete-specific memory boundaries before supporting more than one athlete.",
    securityNotes: [
      "Row-level or tenant-level isolation becomes mandatory once there is more than one athlete.",
      "Audit trails and support access need a stricter authorization model.",
    ],
    acceptanceCriteria: [
      "Multiple athletes can exist without any data leakage between accounts.",
      "Each athlete has isolated integrations, memories, and coaching actions.",
    ],
    openQuestions: [
      "Should coaches be first-class users with access to several athletes?",
      "What is the right permission model for shared coaching relationships?",
    ],
  },
  {
    slug: "holistic-coaching",
    title: "Nutrition, sleep, and strength coaching",
    whyDeferred:
      "The first release should master running-specific coaching before widening the health context further.",
    futureApproach:
      "Layer in additional readiness signals once the product has a stable training-memory model and better guardrails for health-adjacent advice.",
    securityNotes: [
      "These data types can become more sensitive than workout history alone.",
      "Model prompts should stay narrow so additional health context is not over-shared.",
    ],
    acceptanceCriteria: [
      "The product can ingest and reason over at least one additional readiness signal.",
      "Advice clearly distinguishes training guidance from broader wellness suggestions.",
    ],
    openQuestions: [
      "Which signal should come first: sleep, fueling, or strength work?",
      "How much of this belongs in third-party messaging versus the first-party dashboard?",
    ],
  },
  {
    slug: "voice-interface",
    title: "Voice interface",
    whyDeferred:
      "Text-first coaching is faster to ship, easier to audit, and safer while the product is still refining tone and advice quality.",
    futureApproach:
      "Introduce voice once the assistant’s core coaching behavior is reliable enough to deserve a faster interface.",
    securityNotes: [
      "Voice transcripts can contain sensitive context and should be protected like chat history.",
      "Audio uploads may increase storage and retention complexity.",
    ],
    acceptanceCriteria: [
      "The athlete can trigger a voice check-in and receive a spoken or transcribed response.",
      "Voice sessions land in the same memory system as text conversations.",
    ],
    openQuestions: [
      "Should voice be synchronous live chat or asynchronous voice notes?",
      "What level of transcription quality is required before storing conversation context?",
    ],
  },
  {
    slug: "commercial-compliance",
    title: "Commercial-grade compliance posture",
    whyDeferred:
      "The MVP is for personal use, so the repo should not block on the heavier compliance work required for a commercial health-data product.",
    futureApproach:
      "Treat privacy engineering, legal review, and policy documentation as a dedicated workstream before any paid or multi-user rollout.",
    securityNotes: [
      "Commercial use likely requires stronger vendor reviews, deletion guarantees, and documented operational controls.",
      "Data processing agreements and regulatory counsel become much more important once other users are involved.",
    ],
    acceptanceCriteria: [
      "The product has documented privacy, retention, deletion, and incident-response policies.",
      "Core infrastructure choices are reviewed against the relevant legal and regulatory posture.",
    ],
    openQuestions: [
      "Which jurisdictions matter first if the product expands beyond personal use?",
      "Which providers can support the necessary contractual posture?",
    ],
  },
  {
    slug: "runna-write-back",
    title: "Automatic Runna write-back",
    whyDeferred:
      "Write-back is strictly lower priority than building a trustworthy coach, and it depends on a deeper Runna integration path than the MVP has.",
    futureApproach:
      "Only consider this after a richer Runna sync path exists and the product can explain recommendation changes clearly.",
    securityNotes: [
      "Write access should never be enabled until the integration path is stable and auditable.",
      "Plan-editing actions need approval and rollback paths.",
    ],
    acceptanceCriteria: [
      "Approved changes can be synced back to Runna or its replacement source accurately.",
      "The athlete can see what was written back and why.",
    ],
    openQuestions: [
      "Will Runna ever expose enough write support to make this practical?",
      "If not, should write-back target a different plan system instead?",
    ],
  },
];
