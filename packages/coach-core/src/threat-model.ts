// ---------------------------------------------------------------------------
// Threat Model & Data Governance — code-backed definitions for the MVP
// ---------------------------------------------------------------------------

export type Severity = "critical" | "high" | "medium" | "low";
export type MvpRelevance = "active" | "deferred";

// ---- Threat actors --------------------------------------------------------

export type ThreatActor = {
  id: string;
  name: string;
  description: string;
  mvpRelevance: MvpRelevance;
  examples: string[];
};

export const threatActors: ThreatActor[] = [
  {
    id: "compromised-provider",
    name: "Compromised third-party provider",
    description:
      "A provider the system depends on (Strava, Telegram, or the frontier-model API) is breached or acts beyond its expected scope.",
    mvpRelevance: "active",
    examples: [
      "Strava API breach exposes stored OAuth tokens.",
      "Model provider retains or logs prompt content containing health-adjacent data.",
      "Telegram infrastructure intercepts message bodies.",
    ],
  },
  {
    id: "stolen-session",
    name: "Stolen device or session",
    description:
      "An attacker gains access to the athlete's browser session, API keys, or local device.",
    mvpRelevance: "active",
    examples: [
      "Browser session hijacking exposes the dashboard.",
      "Leaked .env file gives full API and bot-token access.",
    ],
  },
  {
    id: "malicious-inbound",
    name: "Malicious inbound messages",
    description:
      "Crafted Telegram messages attempt prompt injection, command injection, or data exfiltration through the coaching interface.",
    mvpRelevance: "active",
    examples: [
      "Prompt-injection payload in a Telegram message steers the model to leak context.",
      "Spoofed webhook calls bypass the secret check.",
    ],
  },
  {
    id: "insider-multi-tenant",
    name: "Cross-tenant data leakage",
    description:
      "In a future multi-user setup, one athlete's data leaks to another account. Not applicable while the system is single-user.",
    mvpRelevance: "deferred",
    examples: [
      "Missing row-level security exposes another athlete's memories.",
      "Shared model-prompt cache bleeds context across users.",
    ],
  },
];

// ---- Top risks ------------------------------------------------------------

export type Risk = {
  id: string;
  title: string;
  severity: Severity;
  category: string;
  description: string;
  mitigations: string[];
  mvpRelevance: MvpRelevance;
};

export const topRisks: Risk[] = [
  {
    id: "risk-model-data-leak",
    title: "Health-adjacent data leakage via model prompts",
    severity: "critical",
    category: "provider-guardrails",
    description:
      "Sending raw injury flags, medical notes, or detailed health context to a frontier-model provider where it may be logged, trained on, or exposed.",
    mitigations: [
      "Pseudonymize and minimize all prompt content before sending.",
      "Never include raw injury notes or medical terminology in prompts.",
      "Prefer categorical descriptors (e.g. 'musculoskeletal flag') over specifics.",
      "Audit prompt payloads in the audit_events table.",
    ],
    mvpRelevance: "active",
  },
  {
    id: "risk-token-compromise",
    title: "OAuth / API token compromise",
    severity: "critical",
    category: "credential-management",
    description:
      "Strava OAuth tokens, Telegram bot tokens, or model-provider API keys are exposed through logs, source code, or a database breach.",
    mitigations: [
      "Application-layer encrypt all tokens at rest.",
      "Never log token values — log only token metadata (scopes, expiry).",
      "Rotate tokens on any suspected exposure.",
      "Use least-privilege scopes (Strava: read,activity:read only).",
    ],
    mvpRelevance: "active",
  },
  {
    id: "risk-messaging-overexposure",
    title: "Sensitive context sent through Telegram",
    severity: "high",
    category: "messaging-constraints",
    description:
      "Detailed injury notes, health flags, or verbose coaching context is sent through Telegram where it is stored on third-party infrastructure.",
    mitigations: [
      "Telegram messages must stay concise: nudges and check-ins only.",
      "Never send injury details, medical notes, or full memory context via Telegram.",
      "The first-party dashboard remains the system of record for sensitive context.",
    ],
    mvpRelevance: "active",
  },
  {
    id: "risk-webhook-spoofing",
    title: "Spoofed Telegram webhook calls",
    severity: "high",
    category: "inbound-validation",
    description:
      "An attacker sends forged Telegram webhook payloads to trigger coaching actions or extract information.",
    mitigations: [
      "Require and verify the TELEGRAM_WEBHOOK_SECRET header on every inbound call.",
      "Reject any webhook payload that does not match the configured chat ID.",
      "Log rejected webhook attempts in audit_events.",
    ],
    mvpRelevance: "active",
  },
  {
    id: "risk-prompt-injection",
    title: "Prompt injection through athlete messages",
    severity: "high",
    category: "inbound-validation",
    description:
      "A crafted inbound message manipulates the model's system prompt to leak context, override safety instructions, or generate harmful advice.",
    mitigations: [
      "Treat all inbound text as untrusted user content in prompt construction.",
      "Use a strict system prompt boundary that the model cannot override.",
      "Limit the length and character set of inbound messages before prompt assembly.",
      "Log prompt-assembly inputs for post-hoc review.",
    ],
    mvpRelevance: "active",
  },
  {
    id: "risk-unencrypted-at-rest",
    title: "Unencrypted sensitive data at rest",
    severity: "high",
    category: "data-protection",
    description:
      "Sensitive fields (tokens, injury flags, message bodies) stored without application-layer encryption, relying only on disk encryption.",
    mitigations: [
      "Apply application-layer encryption to all fields listed in sensitiveFieldControls.",
      "Encrypt database backups and object-storage buckets.",
      "Verify encryption coverage as new sensitive fields are added.",
    ],
    mvpRelevance: "active",
  },
  {
    id: "risk-excessive-retention",
    title: "Excessive data retention without deletion controls",
    severity: "medium",
    category: "data-lifecycle",
    description:
      "Training data, messages, or tokens are retained indefinitely with no mechanism for the athlete to request deletion or review what is stored.",
    mitigations: [
      "Implement retention rules for each data class.",
      "Provide a dashboard control for the athlete to trigger data deletion.",
      "Automatically purge revoked tokens and expired sessions.",
    ],
    mvpRelevance: "active",
  },
];

// ---- Data classification --------------------------------------------------

export type DataClassification = {
  id: string;
  label: string;
  sensitivity: Severity;
  description: string;
  examples: string[];
  retentionPolicy: string;
  deletionRule: string;
};

export const dataClassifications: DataClassification[] = [
  {
    id: "class-credentials",
    label: "Authentication credentials",
    sensitivity: "critical",
    description:
      "OAuth tokens, API keys, bot tokens, and webhook secrets that grant access to external systems.",
    examples: [
      "Strava access_token and refresh_token",
      "Telegram bot token",
      "Model provider API key",
    ],
    retentionPolicy: "Retain only while the integration is active. Purge on disconnect.",
    deletionRule: "Immediate cryptographic erasure on revocation or disconnect.",
  },
  {
    id: "class-health-adjacent",
    label: "Health-adjacent data",
    sensitivity: "critical",
    description:
      "Injury flags, recovery notes, medical context, and any data that could reveal health conditions.",
    examples: [
      "athlete_profiles.injury_flags",
      "coach_memories.detail (injury category)",
      "Free-text notes mentioning pain, fatigue, or illness",
    ],
    retentionPolicy: "Retain while relevant to active coaching. Offer periodic review.",
    deletionRule: "Athlete can delete individual entries at any time via the dashboard.",
  },
  {
    id: "class-training",
    label: "Training activity data",
    sensitivity: "high",
    description:
      "Completed workout history, GPS routes, effort ratings, and training load metrics imported from Strava.",
    examples: [
      "completed_workouts rows",
      "Strava activity summaries",
      "Perceived effort and distance logs",
    ],
    retentionPolicy: "Retain for the lifetime of the coaching relationship.",
    deletionRule: "Bulk or selective deletion available through the dashboard.",
  },
  {
    id: "class-coaching-context",
    label: "Coaching context and memory",
    sensitivity: "high",
    description:
      "Long-term coach memory entries, athlete preferences, patterns, and goals that shape coaching behavior.",
    examples: [
      "coach_memories rows",
      "goals rows",
      "Athlete profile preferences and constraints",
    ],
    retentionPolicy: "Retain while the coaching relationship is active.",
    deletionRule: "Individual memory entries deletable by the athlete.",
  },
  {
    id: "class-messages",
    label: "Communication history",
    sensitivity: "high",
    description:
      "Inbound and outbound message bodies exchanged through Telegram or future messaging channels.",
    examples: [
      "coach_messages.body",
      "Telegram inbound text",
      "Outbound nudge content",
    ],
    retentionPolicy:
      "Retain recent messages for coaching continuity. Archive or purge messages older than 90 days.",
    deletionRule: "Athlete can clear message history through the dashboard.",
  },
  {
    id: "class-audit",
    label: "Audit and operational logs",
    sensitivity: "low",
    description:
      "Security events, webhook receipts, and operational metadata without sensitive payload content.",
    examples: [
      "audit_events rows",
      "Login timestamps",
      "Webhook validation outcomes",
    ],
    retentionPolicy: "Retain for at least 12 months for security review.",
    deletionRule: "Automated purge after the retention window unless flagged for investigation.",
  },
];

// ---- Provider guardrails --------------------------------------------------

export type ProviderGuardrail = {
  provider: string;
  scope: string;
  rules: string[];
  mvpRelevance: MvpRelevance;
};

export const providerGuardrails: ProviderGuardrail[] = [
  {
    provider: "Frontier model provider",
    scope: "Prompt construction and data minimization",
    rules: [
      "Pseudonymize the athlete identity in every prompt.",
      "Strip raw injury notes and replace with categorical descriptors.",
      "Never include OAuth tokens, API keys, or credentials in prompt context.",
      "Cap prompt size to limit accidental over-sharing of training history.",
      "Log prompt metadata (token count, categories included) in audit_events — never log the prompt body.",
      "Prefer providers with data-processing agreements that prohibit training on prompt content.",
    ],
    mvpRelevance: "active",
  },
  {
    provider: "Strava",
    scope: "OAuth and activity sync",
    rules: [
      "Request the minimum scope required: read,activity:read.",
      "Encrypt access_token and refresh_token with application-layer encryption.",
      "Exchange authorization codes server-side only — never expose the client secret to the browser.",
      "Validate webhook payloads before processing activity updates.",
      "Revoke tokens and purge stored credentials when the athlete disconnects.",
    ],
    mvpRelevance: "active",
  },
  {
    provider: "Telegram",
    scope: "Messaging delivery and inbound handling",
    rules: [
      "Use the bot token as a high-risk credential — rotate on any suspected exposure.",
      "Verify the webhook secret header before accepting inbound updates.",
      "Constrain inbound processing to the configured TELEGRAM_CHAT_ID.",
      "Keep outbound messages concise: nudges and check-ins only.",
      "Never send injury details, health notes, or full memory dumps via Telegram.",
    ],
    mvpRelevance: "active",
  },
  {
    provider: "Garmin",
    scope: "Workout import (deferred)",
    rules: [
      "Do not implement until a supported API or mediated import path is available.",
      "Encrypt any stored tokens or raw FIT files.",
      "Do not rely on scraping or unsupported session reuse.",
    ],
    mvpRelevance: "deferred",
  },
  {
    provider: "Runna",
    scope: "Plan sync (deferred)",
    rules: [
      "Do not implement until a richer integration path exists beyond ICS.",
      "Review terms of service before any unofficial API usage.",
      "Never store scraped credentials or brittle session tokens.",
    ],
    mvpRelevance: "deferred",
  },
];

// ---- Messaging constraints ------------------------------------------------

export type MessagingConstraint = {
  channel: string;
  maxContentScope: string;
  prohibitedContent: string[];
  mvpRelevance: MvpRelevance;
};

export const messagingConstraints: MessagingConstraint[] = [
  {
    channel: "Telegram",
    maxContentScope: "Concise nudges, check-in prompts, and short coaching suggestions.",
    prohibitedContent: [
      "Detailed injury descriptions or medical context",
      "Full training-history dumps",
      "Raw coach-memory entries",
      "OAuth tokens or credentials",
      "Verbose model-generated analysis",
    ],
    mvpRelevance: "active",
  },
  {
    channel: "First-party dashboard",
    maxContentScope:
      "Full coaching context including training history, memories, injury flags, and detailed analysis. The dashboard is the system of record.",
    prohibitedContent: [
      "Raw OAuth tokens displayed in the UI (show metadata only)",
      "Unredacted model prompt content",
    ],
    mvpRelevance: "active",
  },
];

// ---- Aggregate summary for API / dashboard --------------------------------

export type ThreatModelSummary = {
  version: string;
  scope: string;
  threatActors: ThreatActor[];
  topRisks: Risk[];
  dataClassifications: DataClassification[];
  providerGuardrails: ProviderGuardrail[];
  messagingConstraints: MessagingConstraint[];
  activeRiskCount: number;
  activeMitigationCount: number;
};

export function buildThreatModelSummary(): ThreatModelSummary {
  const activeRisks = topRisks.filter((r) => r.mvpRelevance === "active");
  const activeMitigationCount = activeRisks.reduce(
    (sum, r) => sum + r.mitigations.length,
    0,
  );

  return {
    version: "1.0.0",
    scope:
      "Single-user MVP: Strava-first workout ingestion, Telegram messaging, frontier-model coaching with strong privacy controls.",
    threatActors,
    topRisks,
    dataClassifications,
    providerGuardrails,
    messagingConstraints,
    activeRiskCount: activeRisks.length,
    activeMitigationCount,
  };
}
