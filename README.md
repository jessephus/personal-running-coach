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

## Deployment modes

This repo now supports both:

- **Direct host / cloud deployment** — run the web app and worker as normal Node processes against any Postgres instance.
- **Self-hosted local stack** — run Postgres, migrations, the web app, and the worker together with Docker Compose.

The application code path is the same in both modes. The difference is only how the processes are started and where `DATABASE_URL` points.

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
- `MODEL_PROVIDER_BASE_URL` (optional, for OpenAI-compatible providers)
- `MODEL_PROVIDER_MODEL` (optional, to override the default structured-output model)
- `CHECKIN_INTERVAL_HOURS` (optional, for the worker cadence)

Optional self-host overrides used by `docker-compose.yml`:

- `SELF_HOST_APP_URL`
- `SELF_HOST_APP_PORT`
- `SELF_HOST_POSTGRES_DB`
- `SELF_HOST_POSTGRES_USER`
- `SELF_HOST_POSTGRES_PASSWORD`
- `SELF_HOST_POSTGRES_PORT`

## Commands

```bash
npm install
npm run dev:web
npm run dev:worker
npm run db:generate
npm run db:migrate
npm run check
```

Self-hosted stack commands:

```bash
npm run selfhost:up
npm run selfhost:down
npm run selfhost:logs
npm run selfhost:migrate
```

Those commands use a small wrapper script that works with either `docker compose` or `docker-compose`.

## Self-host locally

1. Copy `.env.example` to `.env`.
2. Fill in the Strava, Telegram, encryption, and model-provider secrets.
3. Install Docker plus Docker Compose (`docker compose` plugin or `docker-compose` binary).
4. Run `npm run selfhost:up`.
5. Open the dashboard at `SELF_HOST_APP_URL` (defaults to `http://localhost:3000`).

Notes:

- Docker Compose starts **Postgres**, runs **migrations**, then starts the **web app** and **worker**.
- The Compose stack injects its own internal `DATABASE_URL`, so your host-machine `DATABASE_URL` can still point somewhere else for non-Docker workflows.
- If you want Strava and Telegram webhooks to hit your self-hosted app, `SELF_HOST_APP_URL` must be reachable from the public internet. For a laptop/local setup, that usually means using a tunnel such as ngrok or Cloudflare Tunnel.
- For a LAN or VPS deployment, point `SELF_HOST_APP_URL` at that reachable hostname instead of localhost.

## Direct host or cloud deploy

If you want to run without Docker Compose:

1. Provision Postgres anywhere you want.
2. Set `DATABASE_URL` to that database.
3. Run `npm run db:migrate`.
4. Start the web app with `npm run start --workspace @personal-running-coach/web -- --hostname 0.0.0.0 --port 3000`.
5. Start the worker with `npm run start --workspace @personal-running-coach/worker`.

This path works for a VPS, a home server, Railway/Render/Fly-style deployments, or any other Node-friendly host.

To create GitHub Issues for the deferred roadmap:

```bash
npm run issues:deferred -- jessephus/personal-running-coach
```

## Security baseline

- Encrypt the database, object storage, and backups at rest.
- Use application-layer encryption for the most sensitive fields such as tokens, injury notes, and message bodies.
- Keep WhatsApp/Telegram messages concise and avoid sending detailed injury context there.
- Minimize and pseudonymize model prompts before sending them to frontier-model providers.
- Do not expose your `.env` file, bot tokens, or encryption key inside container images or public repos.

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
