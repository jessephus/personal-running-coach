// ---------------------------------------------------------------------------
// Governance — code-backed retention policies, export/delete contracts,
// audit coverage helpers, and prompt-privacy review foundations
// ---------------------------------------------------------------------------

import { dataClassifications, type DataClassification } from "./threat-model";

// ---- Retention policies ---------------------------------------------------

export type RetentionUnit = "days" | "months";

export type RetentionPolicy = {
  dataClassId: string;
  label: string;
  retentionDays: number;
  pruneStrategy: "hard-delete" | "soft-delete" | "archive";
  description: string;
};

/**
 * Code-backed retention schedule derived from data classifications.
 * Each policy defines the maximum age before data should be pruned and the
 * strategy used to prune it. These are enforcement-ready, not aspirational.
 */
export const retentionPolicies: RetentionPolicy[] = [
  {
    dataClassId: "class-credentials",
    label: "Authentication credentials",
    retentionDays: 0,
    pruneStrategy: "hard-delete",
    description:
      "Purge immediately on disconnect or revocation. No retained copies.",
  },
  {
    dataClassId: "class-health-adjacent",
    label: "Health-adjacent data",
    retentionDays: 365,
    pruneStrategy: "soft-delete",
    description:
      "Retain while relevant to active coaching. Offer annual review. Soft-delete preserves audit linkage.",
  },
  {
    dataClassId: "class-training",
    label: "Training activity data",
    retentionDays: 730,
    pruneStrategy: "archive",
    description:
      "Retain for the coaching relationship lifetime. Archive after 2 years of inactivity.",
  },
  {
    dataClassId: "class-coaching-context",
    label: "Coaching context and memory",
    retentionDays: 365,
    pruneStrategy: "soft-delete",
    description:
      "Retain while coaching is active. Soft-delete after 1 year of inactivity.",
  },
  {
    dataClassId: "class-messages",
    label: "Communication history",
    retentionDays: 90,
    pruneStrategy: "hard-delete",
    description:
      "Purge message bodies older than 90 days. Audit metadata is preserved separately.",
  },
  {
    dataClassId: "class-audit",
    label: "Audit and operational logs",
    retentionDays: 365,
    pruneStrategy: "archive",
    description:
      "Retain for at least 12 months. Archive after the retention window.",
  },
];

export function getRetentionPolicy(dataClassId: string): RetentionPolicy | undefined {
  return retentionPolicies.find((p) => p.dataClassId === dataClassId);
}

export function getRetentionCutoffDate(policy: RetentionPolicy, asOf: Date = new Date()): Date {
  return new Date(asOf.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
}

// ---- Pruning plan ---------------------------------------------------------

export type PrunableTable = {
  tableName: string;
  dataClassId: string;
  timestampColumn: string;
  pruneStrategy: RetentionPolicy["pruneStrategy"];
  retentionDays: number;
};

/**
 * Maps database tables to their retention policies and timestamp columns.
 * Used by the pruning operation to determine what rows are eligible.
 */
export const prunableTables: PrunableTable[] = [
  {
    tableName: "raw_imports",
    dataClassId: "class-training",
    timestampColumn: "created_at",
    pruneStrategy: "archive",
    retentionDays: 730,
  },
  {
    tableName: "coach_messages",
    dataClassId: "class-messages",
    timestampColumn: "sent_at",
    pruneStrategy: "hard-delete",
    retentionDays: 90,
  },
  {
    tableName: "coach_memories",
    dataClassId: "class-coaching-context",
    timestampColumn: "created_at",
    pruneStrategy: "soft-delete",
    retentionDays: 365,
  },
  {
    tableName: "audit_events",
    dataClassId: "class-audit",
    timestampColumn: "occurred_at",
    pruneStrategy: "archive",
    retentionDays: 365,
  },
];

// ---- Export manifest -------------------------------------------------------

export type ExportManifest = {
  version: string;
  exportedAt: string;
  athleteId: string;
  encrypted: boolean;
  sections: ExportSection[];
  retentionSnapshot: RetentionPolicy[];
};

export type ExportSection = {
  key: string;
  label: string;
  recordCount: number;
  dataClassId: string;
  containsSensitiveData: boolean;
};

export function buildExportManifest(input: {
  athleteId: string;
  sections: ExportSection[];
  encrypted: boolean;
}): ExportManifest {
  return {
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    athleteId: input.athleteId,
    encrypted: input.encrypted,
    sections: input.sections,
    retentionSnapshot: retentionPolicies,
  };
}

// ---- Deletion plan --------------------------------------------------------

export type DeletionScope =
  | "full"
  | "credentials-only"
  | "messages-only"
  | "training-only"
  | "memories-only";

export type DeletionPlan = {
  scope: DeletionScope;
  athleteId: string;
  tables: DeletionTarget[];
  auditAction: string;
};

export type DeletionTarget = {
  tableName: string;
  cascadeFromAthlete: boolean;
  description: string;
};

/**
 * Build a deletion plan for the given scope. The plan is data-only —
 * execution happens in the web layer with database access.
 */
export function buildDeletionPlan(athleteId: string, scope: DeletionScope): DeletionPlan {
  const targets: Record<DeletionScope, DeletionTarget[]> = {
    full: [
      { tableName: "coach_messages", cascadeFromAthlete: true, description: "All coaching messages" },
      { tableName: "coach_memories", cascadeFromAthlete: true, description: "All coaching memories" },
      { tableName: "completed_workouts", cascadeFromAthlete: true, description: "All completed workouts" },
      { tableName: "raw_imports", cascadeFromAthlete: true, description: "All raw import payloads" },
      { tableName: "goals", cascadeFromAthlete: true, description: "All goals" },
      { tableName: "source_connections", cascadeFromAthlete: true, description: "All integration connections" },
      { tableName: "athlete_profiles", cascadeFromAthlete: false, description: "Athlete profile record" },
    ],
    "credentials-only": [
      { tableName: "source_connections", cascadeFromAthlete: true, description: "All integration connections and stored tokens" },
    ],
    "messages-only": [
      { tableName: "coach_messages", cascadeFromAthlete: true, description: "All coaching messages" },
    ],
    "training-only": [
      { tableName: "completed_workouts", cascadeFromAthlete: true, description: "All completed workouts" },
      { tableName: "raw_imports", cascadeFromAthlete: true, description: "All raw import payloads" },
    ],
    "memories-only": [
      { tableName: "coach_memories", cascadeFromAthlete: true, description: "All coaching memories" },
    ],
  };

  return {
    scope,
    athleteId,
    tables: targets[scope],
    auditAction: `governance.delete.${scope}`,
  };
}

// ---- Audit coverage -------------------------------------------------------

export type AuditCoverageEntry = {
  action: string;
  description: string;
  implemented: boolean;
};

/**
 * Registry of auditable actions. Each entry describes an action that should
 * produce an audit_events row when it occurs. The `implemented` flag tracks
 * whether the codebase currently emits this event.
 */
export const auditCoverageRegistry: AuditCoverageEntry[] = [
  { action: "strava.oauth.connected", description: "Strava OAuth flow completed", implemented: true },
  { action: "strava.oauth.disconnected", description: "Strava OAuth tokens revoked", implemented: false },
  { action: "strava.sync.completed", description: "Manual or scheduled Strava sync finished", implemented: false },
  { action: "strava.webhook.received", description: "Inbound Strava webhook processed", implemented: true },
  { action: "strava.webhook.ignored", description: "Inbound Strava webhook filtered or ignored", implemented: true },
  { action: "telegram.webhook.received", description: "Inbound Telegram webhook accepted", implemented: false },
  { action: "telegram.webhook.rejected", description: "Inbound Telegram webhook rejected (bad secret or chat)", implemented: false },
  { action: "telegram.message.sent", description: "Outbound Telegram message delivered", implemented: false },
  { action: "governance.export.requested", description: "Athlete data export initiated", implemented: true },
  { action: "governance.export.completed", description: "Athlete data export completed", implemented: true },
  { action: "governance.delete.requested", description: "Athlete data deletion initiated", implemented: true },
  { action: "governance.delete.completed", description: "Athlete data deletion completed", implemented: true },
  { action: "governance.prune.executed", description: "Retention-based pruning executed", implemented: true },
  { action: "prompt.assembled", description: "Coaching prompt assembled (metadata only — not body)", implemented: false },
];

export type AuditCoverageSummary = {
  totalActions: number;
  implementedActions: number;
  coveragePercent: number;
  gaps: AuditCoverageEntry[];
};

export function buildAuditCoverageSummary(): AuditCoverageSummary {
  const implemented = auditCoverageRegistry.filter((e) => e.implemented);
  const gaps = auditCoverageRegistry.filter((e) => !e.implemented);

  return {
    totalActions: auditCoverageRegistry.length,
    implementedActions: implemented.length,
    coveragePercent: Math.round((implemented.length / auditCoverageRegistry.length) * 100),
    gaps,
  };
}

// ---- Prompt privacy review ------------------------------------------------

export type PromptPrivacyFlag = {
  id: string;
  label: string;
  severity: "critical" | "high" | "medium";
  pattern: RegExp;
  guidance: string;
};

/**
 * Patterns that should never appear in an outbound model prompt.
 * Used by reviewPromptForPrivacy() to flag content before it is sent.
 */
export const promptPrivacyFlags: PromptPrivacyFlag[] = [
  {
    id: "raw-token",
    label: "Raw authentication token",
    severity: "critical",
    pattern: /\b(eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36})\b/,
    guidance: "Never include OAuth tokens, API keys, or bot tokens in prompts.",
  },
  {
    id: "medical-term",
    label: "Medical terminology",
    severity: "high",
    pattern: /\b(diagnosis|prescription|medication|doctor|physician|surgery|MRI|x-ray|fracture|tendonitis|plantar fasciitis)\b/i,
    guidance: "Replace specific medical terms with categorical descriptors (e.g., 'musculoskeletal flag').",
  },
  {
    id: "pii-email",
    label: "Email address",
    severity: "high",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    guidance: "Pseudonymize the athlete. Never include email addresses in prompts.",
  },
  {
    id: "pii-phone",
    label: "Phone number",
    severity: "high",
    pattern: /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
    guidance: "Never include phone numbers in prompts.",
  },
  {
    id: "verbose-injury",
    label: "Verbose injury description",
    severity: "medium",
    pattern: /\b(sharp pain|chronic pain|inflammation|swelling|torn|rupture|sprain)\b/i,
    guidance: "Use categorical injury descriptors instead of detailed clinical language.",
  },
];

export type PromptPrivacyViolation = {
  flagId: string;
  label: string;
  severity: PromptPrivacyFlag["severity"];
  matchedText: string;
  guidance: string;
};

export type PromptPrivacyReview = {
  passed: boolean;
  violations: PromptPrivacyViolation[];
  reviewedAt: string;
  promptLengthChars: number;
};

/**
 * Review a prompt string for privacy violations before sending to a model.
 * Returns a structured review with all violations found.
 */
export function reviewPromptForPrivacy(
  promptText: string,
  flags: PromptPrivacyFlag[] = promptPrivacyFlags,
): PromptPrivacyReview {
  const violations: PromptPrivacyViolation[] = [];

  for (const flag of flags) {
    const match = promptText.match(flag.pattern);
    if (match) {
      violations.push({
        flagId: flag.id,
        label: flag.label,
        severity: flag.severity,
        matchedText: match[0].slice(0, 20) + (match[0].length > 20 ? "…" : ""),
        guidance: flag.guidance,
      });
    }
  }

  return {
    passed: violations.length === 0,
    violations,
    reviewedAt: new Date().toISOString(),
    promptLengthChars: promptText.length,
  };
}

// ---- Governance summary ---------------------------------------------------

export type GovernanceSummary = {
  version: string;
  retentionPolicies: RetentionPolicy[];
  auditCoverage: AuditCoverageSummary;
  promptPrivacyFlagCount: number;
  dataClassificationCount: number;
  deletionScopes: DeletionScope[];
  exportEncrypted: boolean;
};

export function buildGovernanceSummary(): GovernanceSummary {
  return {
    version: "1.0.0",
    retentionPolicies,
    auditCoverage: buildAuditCoverageSummary(),
    promptPrivacyFlagCount: promptPrivacyFlags.length,
    dataClassificationCount: dataClassifications.length,
    deletionScopes: ["full", "credentials-only", "messages-only", "training-only", "memories-only"],
    exportEncrypted: true,
  };
}
