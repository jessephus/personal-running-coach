# Copilot instructions for `personal-running-coach`

## Build, lint, typecheck, and database commands

From the repository root:

```bash
npm run build
npm run lint
npm run typecheck
npm run check
```

Useful workspace-scoped commands:

```bash
npm run dev:web
npm run dev:worker
npm run db:generate
npm run db:migrate
npm run db:studio
```

Run a single workspace directly when you only need one surface:

```bash
npm run build --workspace @personal-running-coach/web
npm run lint --workspace @personal-running-coach/web
npm run typecheck --workspace @personal-running-coach/web

npm run build --workspace @personal-running-coach/worker
npm run typecheck --workspace @personal-running-coach/db
```

There is currently **no automated test script or test file suite configured** in this repo, so there is no single-test command to run yet.

## High-level architecture

This is an npm workspace monorepo with two apps and three shared packages:

- `apps/web`: Next.js 16 app that serves the dashboard plus API routes.
- `apps/worker`: background Telegram check-in worker.
- `packages/coach-core`: domain types, demo data, threat model, governance rules, memory/state builders, and coaching workflow generators.
- `packages/db`: Drizzle schema, connection helpers, migration entrypoint, and the catalog of sensitive-field protections.
- `packages/integrations`: integration-specific helpers for environment metadata, Strava, and Telegram.

The important split is **demo coaching surfaces vs. live data surfaces**:

- The dashboard (`apps/web/src/lib/dashboard-data.ts`) and the `/api/coaching/*` routes currently build previews from `packages/coach-core/src/demo-data.ts`.
- Live database-backed behavior is concentrated in `apps/web/src/lib/strava-ingestion.ts` and `apps/web/src/lib/governance.ts`.
- Strava data flows as: OAuth/webhook route -> `strava-ingestion.ts` -> encrypted `raw_imports` row -> normalized `completed_workouts` row.
- Governance routes expose data lifecycle operations defined in `coach-core` and executed in the web layer against Drizzle/Postgres.
- The worker reuses `coach-core` workflow outputs and `integrations` Telegram helpers to choose one coaching nudge and send a concise outbound message.

`apps/web` is the MVP system of record. Telegram is treated as a narrow delivery channel, not the place for full sensitive context.

## Key conventions

### Environment and secret handling

- Define env requirements in `packages/integrations/src/env.ts`.
- Use `validateEnv(...)` at startup, `requireEnvVar(...)` for server-only secret access, and `getEnvMeta(...)` / `getEnvironmentStatus()` when a route or UI needs safe presence-only metadata.
- Do not expose raw env values to client components or JSON responses unless the value is intentionally public.

### Workflow output shape

- Coaching logic belongs in `packages/coach-core`.
- Workflow generators return the shared `WorkflowResult` shape from `packages/coach-core/src/workflows/types.ts`; callers in the web app and worker render or send that result instead of inventing ad hoc response shapes.
- Risk and approval behavior is centralized in workflow guardrails. Preserve `risk`, `requiresApproval`, `approvalReason`, and Telegram-safe output when changing workflow code.

### Privacy and messaging constraints

- Follow `packages/db/src/schema.ts` for sensitive fields: tokens, webhook secrets, injury context, message bodies, and raw payloads are expected to use application-layer encryption and redacted previews.
- Telegram handling is deliberately strict: verify the webhook secret before parsing the body, filter to `TELEGRAM_CHAT_ID`, reject oversized inbound text, and keep outbound messages within the 500-character cap.
- Do not send detailed injury/medical context through Telegram. Keep sensitive detail in the dashboard/database surfaces.

### Single-user MVP assumptions

- The product is intentionally single-athlete right now; code paths such as Telegram chat filtering and athlete profile creation assume one athlete context.
- Many coaching endpoints still run against demo data even though Strava ingestion and governance already use the live database. Preserve that distinction unless you are intentionally wiring a surface from demo to live data.

### Next.js-specific note

- `apps/web/CLAUDE.md` and `apps/web/AGENTS.md` both note that this repo uses **Next.js 16**. Before making framework-specific changes, check the versioned docs under `node_modules/next/dist/docs/` instead of relying on older Next.js conventions.

### Local scratch space

- `local_temp/` is intentionally gitignored. Use it for local-only exports, curl payloads, webhook notes, temporary scripts, and copied secrets/templates that should never be committed.
