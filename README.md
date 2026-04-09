# Personal Running Coach

A security-first, single-user coaching app scaffold for training context, Strava imports, coach memory, and proactive Telegram nudges.

## MVP focus

- Strava-first workout ingestion
- First-party dashboard as the system of record
- Coach memory and structured training context
- Telegram as the first messaging surface
- Strong privacy controls around health-adjacent data

## What is intentionally deferred

- Garmin ingestion
- Runna plan sync
- Automatic plan write-back
- Multi-athlete support
- Voice, broader wellness coaching, and commercial-grade compliance work

Those deferred items are represented as structured future specs in `packages/coach-core/src/demo-data.ts`, and they can be turned into GitHub Issues automatically.

## Workspace layout

- `apps/web` — Next.js dashboard and API routes
- `apps/worker` — background job and messaging worker preview
- `packages/coach-core` — shared coaching domain types, sample data, and deferred feature specs
- `packages/db` — Postgres schema, migrations, and sensitive-field controls
- `packages/integrations` — integration helpers for Strava and Telegram
- `scripts/create-deferred-issues.ts` — GitHub issue generator for deferred MVP items

## Environment

Copy `.env.example` to `.env` and fill in the values you plan to use:

```bash
cp .env.example .env
```

Important values:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `MODEL_PROVIDER_API_KEY`

## Commands

```bash
npm install
npm run dev:web
npm run dev:worker
npm run db:generate
npm run db:migrate
npm run check
```

To create GitHub Issues for the deferred roadmap:

```bash
npm run issues:deferred -- jessephus/personal-running-coach
```

## Security baseline

- Encrypt the database, object storage, and backups at rest.
- Use application-layer encryption for the most sensitive fields such as tokens, injury notes, and message bodies.
- Keep WhatsApp/Telegram messages concise and avoid sending detailed injury context there.
- Minimize and pseudonymize model prompts before sending them to frontier-model providers.

## Data governance

The repo includes a code-backed governance layer in `packages/coach-core/src/governance.ts` and `apps/web/src/lib/governance.ts`:

- **Retention policies** — per-data-class retention schedules with cutoff calculation and prunable-table mappings.
- **Data export** — full athlete data export (decrypted JSON) with optional re-encryption for secure transfer. Tokens are intentionally excluded from exports.
- **Data deletion** — scoped deletion (`full`, `credentials-only`, `messages-only`, `training-only`, `memories-only`) with audit trail.
- **Retention pruning** — runnable pruning hook that deletes rows older than their retention cutoff across all prunable tables.
- **Audit coverage registry** — tracks which auditable actions are implemented and surfaces coverage gaps.
- **Prompt privacy review** — pattern-based scanner that flags tokens, PII, medical terms, and verbose injury descriptions before they reach model prompts.

### Governance API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/governance/status` | GET | Governance posture summary |
| `/api/governance/export` | POST | Export athlete data |
| `/api/governance/delete` | POST | Delete athlete data (scoped) |
| `/api/governance/prune` | POST | Execute retention-based pruning |
| `/api/governance/audit-summary` | GET | Audit event summary for an athlete |
