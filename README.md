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
- `packages/db` — source-of-truth schema catalog and sensitive-field controls
- `packages/integrations` — integration helpers for Strava and Telegram
- `scripts/create-deferred-issues.ts` — GitHub issue generator for deferred MVP items

## Environment

Copy `.env.example` to `.env` and fill in the values you plan to use:

```bash
cp .env.example .env
```

Important values:

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
