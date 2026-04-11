# Copilot instructions for Coachin'Claw

This file contains context and conventions for the Coachin'Claw project, designed to help you (or an AI assistant) understand the codebase quickly and make effective changes.

## Project overview

**Coachin'Claw** is a health-sensitive coaching app that uses an LLM as the primary decision-making engine while keeping deterministic guardrails in code.

**Core flows:**
1. **Strava ingestion:** User connects Strava account → app fetches workouts → stored encrypted in DB
2. **Coaching decision:** Worker or dashboard requests coaching workflow → LLM analyzes athlete data → generates recommendation → guardrails check safety
3. **Memory extraction:** Inbound Telegram messages → LLM extracts durable athlete memories → persists to DB
4. **Proactive check-ins:** Worker sends periodic LLM-generated nudges through Telegram

**Deployment modes:**
- **Self-hosted:** Docker Compose on laptop or VPS (recommended for privacy-sensitive use)
- **Cloud:** Distributed across Vercel, Railway, Azure, or similar (requires privacy agreements with vendors)

## Repository structure

This is an npm workspace monorepo with 2 apps and 3 packages:

```
CoachinClaw/
├── apps/
│   ├── web/               # Next.js 16 dashboard + API routes
│   └── worker/            # Background Telegram check-in daemon
├── packages/
│   ├── coach-core/        # Domain logic, LLM orchestration, workflows
│   ├── db/                # Drizzle schema, encryption, runtime helpers
│   └── integrations/      # Strava, Telegram, model provider clients
├── docker-compose.yml     # Self-hosted stack (Postgres, migrations, web, worker)
├── Dockerfile             # Single image for web and worker
├── .env.example            # Required secrets and configuration
└── package.json           # Root workspace configuration
```

**Key breakdown:**
- `apps/web`: Next.js 16 app serving the dashboard plus API routes.
- `apps/worker`: Background Telegram check-in daemon that sends proactive LLM-generated nudges.
- `packages/coach-core`: Domain logic including LLM orchestration, workflow generation, and guardrails.
- `packages/db`: Drizzle schema, encryption, and runtime helpers for loading athlete context and persisting outputs.
- `packages/integrations`: Shared clients for Strava, Telegram, and the model provider.

## Key modules

### packages/coach-core/src/llm.ts

**Purpose:** LLM orchestration and validation

**Key functions:**
- `generateCoachingWorkflowWithLlm()` – Build prompt from athlete context, call model, apply guardrails, return structured workflow
- `extractCoachMemoriesWithLlm()` – Parse inbound message, extract persistent memories, filter chatter
- `classifySuggestionRisk()` – Code-owned risk classification (deterministic, code-controlled)

**Important:** Prompt safety review happens before every provider call. PII, tokens, and medical terms are redacted.

### packages/db/src/runtime.ts

**Purpose:** Live athlete context loading and output persistence

**Key functions:**
- `generateCoachingWorkflowForAthlete()` – Load athlete profile, recent workouts, memories; call LLM orchestrator; return workflow
- `extractMemoriesFromInboundMessage()` – Load message thread; call LLM extractor; save new memories
- `persistOutboundCoachMessage()` – Save coach message, audit event, and approval trace

**Important:** Bridges LLM layer with database. Loads context on-demand, no caching. Encrypts sensitive fields before writing.

### packages/integrations/src/model-provider.ts

**Purpose:** Shared OpenAI-compatible client

**Key function:**
- `createModelProviderClient()` – Factory for structured-output capable model client

**Configuration:**
- `MODEL_PROVIDER_API_KEY` – API secret (OpenRouter, Azure, OpenAI, etc.)
- `MODEL_PROVIDER_BASE_URL` – Optional custom endpoint (defaults to OpenRouter)
- `MODEL_PROVIDER_MODEL_NAME` – Optional custom model (defaults to small structured-output capable model)

### apps/web/src/lib/dashboard-data.ts

**Purpose:** Build live coaching workflows for dashboard display

**Behavior:**
- Uses demo data as fallback if live athlete context is not available
- Calls `generateCoachingWorkflowForAthlete()` if Strava is connected
- Returns workflows with guardrail metadata for UI display

### apps/worker/src/index.ts

**Purpose:** Proactive Telegram check-in daemon

**Behavior:**
- Runs on `setInterval(CHECKIN_INTERVAL_HOURS)`
- Calls `generateCoachingWorkflowForAthlete()` to get LLM suggestion
- Persists message and applies guardrails before sending to Telegram
- Falls back to demo mode if credentials are missing

## Environment configuration

**Required for any deployment:**

```bash
DATABASE_URL                    # Postgres connection string
APP_ENCRYPTION_KEY             # Secret for field-level encryption (any strong string)
NEXT_PUBLIC_APP_URL            # Public URL (http://localhost:3000 for local, https://domain for production)
```

**Required for Strava:**

```bash
STRAVA_CLIENT_ID               # OAuth client ID
STRAVA_CLIENT_SECRET           # OAuth secret
STRAVA_WEBHOOK_VERIFY_TOKEN    # Webhook verification token
```

**Required for Telegram:**

```bash
TELEGRAM_BOT_TOKEN             # Bot token from @BotFather
TELEGRAM_CHAT_ID               # Your personal chat ID
TELEGRAM_WEBHOOK_SECRET        # Webhook signature token
```

**Required for LLM:**

```bash
MODEL_PROVIDER_API_KEY         # API key (OpenRouter, Azure, OpenAI, etc.)
MODEL_PROVIDER_BASE_URL        # Optional custom endpoint
MODEL_PROVIDER_MODEL_NAME      # Optional custom model
```

**Optional:**

```bash
CHECKIN_INTERVAL_HOURS=24      # How often worker sends check-ins (default: 24)
```

**Validation:** Use `validateEnv()` from `packages/integrations/src/env.ts` at app startup. It raises if required vars are missing.

## Build, lint, typecheck, and database commands

From the repository root:

```bash
npm run build                  # Build all workspaces
npm run lint                   # Lint all workspaces
npm run typecheck              # Type-check all workspaces
npm run check                  # lint + typecheck (recommended before commit)
```

Workspace-scoped commands:

```bash
npm run dev:web                # Start Next.js dev server (port 3000)
npm run dev:worker             # Start worker (dev mode, immediate check-in)
npm run db:generate            # Regenerate Drizzle client
npm run db:migrate             # Run pending migrations
npm run db:studio              # Open Drizzle Studio (interactive schema explorer)
```

**Single workspace:**

```bash
npm run build --workspace @coachinclaw/web
npm run typecheck --workspace @coachinclaw/db
```

**Self-hosted (Docker Compose):**

```bash
npm run selfhost:up            # Start Postgres, migrations, web, worker
npm run selfhost:down          # Stop all services
npm run selfhost:logs          # Tail all service logs
npm run selfhost:logs web      # Tail web app logs only
```

## Code conventions

### File organization

- **Business logic:** Lives in `packages/coach-core` (workflows, LLM orchestration, guardrails)
- **Data access & persistence:** Lives in `packages/db` (Drizzle schema, runtime helpers, encryption)
- **External clients:** Lives in `packages/integrations` (Strava, Telegram, model provider)
- **API routes & UI:** Lives in `apps/web` (Next.js routes, React components)
- **Daemon logic:** Lives in `apps/worker` (interval-based check-ins)

### Environment and secret handling

- Define env requirements in `packages/integrations/src/env.ts`.
- Use `validateEnv(...)` at startup, `requireEnvVar(...)` for server-only secret access, and `getEnvMeta(...)` / `getEnvironmentStatus()` when a route or UI needs safe presence-only metadata.
- Do not expose raw env values to client components or JSON responses unless the value is intentionally public.

### Workflow output shape

- All coaching logic returns a shared `WorkflowResult` type from `packages/coach-core/src/workflows/types.ts`
- Callers (web routes, worker, dashboard) render or send this result instead of inventing ad hoc response shapes
- Risk and approval behavior is centralized in workflow guardrails. Preserve `risk`, `requiresApproval`, `approvalReason`, and Telegram-safe output when changing workflow code.

### Privacy and encryption

- Sensitive fields (tokens, injury context, message bodies) use AES-256-GCM encryption from `packages/db/src/crypto.ts`
- Prompts are privacy-reviewed before reaching the model: PII, tokens, medical terms redacted
- Telegram messages are deliberately short and non-medical
- Inbound Telegram messages are persisted to DB (not logged to console)
- Follow `packages/db/src/schema.ts` for sensitive fields: tokens, webhook secrets, injury context, message bodies, and raw payloads are expected to use application-layer encryption and redacted previews.
- Telegram handling is deliberately strict: verify the webhook secret before parsing the body, filter to `TELEGRAM_CHAT_ID`, reject oversized inbound text, and keep outbound messages within the 500-character cap.
- Do not send detailed injury/medical context through Telegram. Keep sensitive detail in the dashboard/database surfaces.

### Demo data

- Lives in `packages/coach-core/src/demo-data.ts`
- Used by dashboard and coaching routes when live athlete context is not available
- Intentional fallback for MVP; not a gap
- Eventually all coaching surfaces will wire to live DB, but demo data prevents blank dashboard

### Guardrails

**Code-owned policy, not model-constrained:**

- `classifySuggestionRisk()` in `packages/coach-core/src/workflows/guardrails.ts` decides risk level
- `requiresApproval` gates high-risk suggestions
- Telegram sending constraints: max 500 chars, no injury details, verified webhook secret
- These decisions are exposed in the UI so users understand what's code-owned vs model-owned

### Deterministic vs LLM

- **Deterministic:** Risk classification, approval gates, Telegram char limit, prompt privacy review, webhook verification
- **LLM:** Workflow choice (next_workout vs recovery_check), suggestion text, memory extraction, reasoning explanation

### Single-user MVP assumptions

- The product is intentionally single-athlete right now; code paths such as Telegram chat filtering and athlete profile creation assume one athlete context.
- Telegram chat filtering assumes one `TELEGRAM_CHAT_ID`
- Athlete profile creation happens automatically on first Strava connect
- No multi-user session handling

### Next.js-specific note

- `apps/web/CLAUDE.md` and `apps/web/AGENTS.md` both note that this repo uses **Next.js 16**. Before making framework-specific changes, check the versioned docs under `node_modules/next/dist/docs/` instead of relying on older Next.js conventions.

### Local scratch space

- `local_temp/` is intentionally gitignored. Use it for local-only exports, curl payloads, webhook notes, temporary scripts, and copied secrets/templates that should never be committed.

## Data model highlights

### Schema (packages/db/src/schema.ts)

- **athletes** – User profiles (id, name, goals)
- **completed_workouts** – Strava synced activities (encrypted raw import, normalized data)
- **coach_memories** – Persistent athlete memories extracted from messages
- **coach_messages** – Inbound/outbound message thread (encrypted)
- **coach_approvals** – High-risk suggestion approvals (audit trail)
- **coach_audit_events** – All model calls and outputs (encrypted)

### Sensitive fields

Automatically encrypted at application layer using AES-256-GCM:
- `strava_access_token`, `strava_refresh_token` (athlete tokens)
- `raw_import_payload` (Strava webhook payload)
- `injury_context` (user-reported injury notes)
- `message_text` (Telegram message bodies)
- `memory_content` (extracted athlete memories)
- `prompt_used` (full prompt sent to model, with PII already redacted)
- `response_raw` (full LLM response)

Unencrypted metadata (athlete name, workout duration, approval reason) remains queryable.

## Important caveats

- **No automated test suite.** Use `npm run build && npm run check` to catch regressions.
- **Worker deployment:** Must run on a process host (Railway, Render, Fly, Container Apps). Not serverless-compatible because of `setInterval(...)`.
- **Webhook testing:** Use ngrok or cloudflared to expose localhost publicly.
- **Model provider:** Current env contract validates only `MODEL_PROVIDER_API_KEY`. Custom endpoint URL and model name are optional.
- **Strava syncing:** Matches based on external Strava activity ID, not athlete ID. Handles duplicates gracefully.
- **Self-hosted Docker Compose:** Use `npm run selfhost:up/down` or `docker compose` directly (v1 and v2 compatible).

## Useful files for quick reference

- **Quickstart:** README.md (top-level)
- **Setup & deployment:** local_temp/setup-runbook.md
- **LLM orchestration:** packages/coach-core/src/llm.ts
- **Runtime helpers:** packages/db/src/runtime.ts
- **Model client:** packages/integrations/src/model-provider.ts
- **Env validation:** packages/integrations/src/env.ts
- **Database schema:** packages/db/src/schema.ts
- **Worker logic:** apps/worker/src/index.ts
- **Dashboard data:** apps/web/src/lib/dashboard-data.ts
- **API routes:** apps/web/src/app/api/

## Next steps (not yet implemented)

- Real model provider wiring (currently uses a small structured-output capable model)
- Comprehensive test suite
- Multi-user support (currently single-athlete MVP)
- Custom user guardrail calibration UI (currently hardcoded)
- More sophisticated memory extraction (currently basic heuristics)
- Real Azure/custom endpoint model provider env contract
