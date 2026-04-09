export type TableSpec = {
  tableName: string;
  purpose: string;
  containsSensitiveData: boolean;
  mvpRequired: boolean;
};

export type SensitiveFieldControl = {
  fieldPath: string;
  protection: string;
};

export const tableCatalog: TableSpec[] = [
  {
    tableName: "athlete_profiles",
    purpose: "Core athlete identity, preferences, and coaching constraints.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "goals",
    purpose: "Race targets and priority ordering for training decisions.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "completed_workouts",
    purpose: "Normalized workout history imported from Strava.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "coach_memories",
    purpose: "Curated long-term context such as injuries, patterns, and preferences.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "coach_messages",
    purpose: "Outbound and inbound message history for the coaching assistant.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "source_connections",
    purpose: "Third-party OAuth and webhook configuration metadata.",
    containsSensitiveData: true,
    mvpRequired: true,
  },
  {
    tableName: "audit_events",
    purpose: "Security and operational history without sensitive payload bodies.",
    containsSensitiveData: false,
    mvpRequired: true,
  },
  {
    tableName: "training_plans",
    purpose: "Future-friendly location for detailed planned-workout data if a viable source emerges.",
    containsSensitiveData: true,
    mvpRequired: false,
  },
];

export const sensitiveFieldControls: SensitiveFieldControl[] = [
  {
    fieldPath: "source_connections.access_token",
    protection: "Application-layer encryption and secrets rotation.",
  },
  {
    fieldPath: "source_connections.refresh_token",
    protection: "Application-layer encryption and least-privilege access.",
  },
  {
    fieldPath: "coach_memories.detail",
    protection: "Application-layer encryption for injury and health-adjacent details.",
  },
  {
    fieldPath: "coach_messages.body",
    protection: "Encryption at rest plus redaction from logs.",
  },
  {
    fieldPath: "athlete_profiles.injury_flags",
    protection: "Encryption at rest and privacy-minimized prompt usage.",
  },
];
