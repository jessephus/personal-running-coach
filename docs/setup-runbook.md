# Coachin'Claw setup runbook

This document provides a detailed runbook for setting up and deploying the Coachin'Claw app. It covers architecture, deployment options, environment configuration, and step-by-step instructions for both local self-hosting and cloud deployment.

## Architecture summary

This app is **LLM-driven with code-owned guardrails**:

- The LLM is the primary coaching engine: it generates workout recommendations, decides whether to send check-ins, and extracts athlete memories from inbound messages.
- Deterministic rules remain in code as guardrails: they gate approval of high-risk suggestions, enforce Telegram safety constraints, and redact PII before prompts reach the model.
- The dashboard is live: it shows real athlete data from Strava, displays model-generated workflows, and surfaces guardrail decisions to the user for calibration.
- The worker is proactive: it uses the LLM to generate personalized check-ins and sends them through Telegram.
- Inbound Telegram messages are persisted and fed back to the LLM for memory extraction, creating a continuous feedback loop.

## Recommended deployment choices

Choose a deployment mode first, then select concrete platforms:

### Self-hosted (recommended for privacy-sensitive use)

Run the entire stack—web app, worker, and Postgres—together using Docker Compose or directly on a VPS.

**Advantages:**
- All data stays under your control.
- No platform vendor dependencies (Vercel, Railway, etc.).
- Webhook URLs are stable.
- Simplest for health-sensitive training context.

**Self-host on your laptop (for development):**
```bash
npm run selfhost:up
```

**Self-host on a VPS (for continuous operation):**
Provision a Linux server with Docker. Deploy the same way as your laptop.

### Cloud deployment (if you prefer managed services)

Distribute the app across platforms for scale and built-in monitoring. Use this only if you have privacy controls baked into your model provider agreements and database provider contracts.

**Suggested split:**
1. **Web app:** Vercel or your preferred Node host
2. **Database:** Neon, Supabase, or a managed Postgres provider
3. **Worker:** Railway, Render, or Fly.io
4. **Model provider:** OpenRouter, Azure OpenAI, or your preferred inference service

## Step 1: Create the required secrets

Copy the env template:

```bash
cp .env.example .env
```

Generate the secrets you control:

```bash
openssl rand -hex 32   # APP_ENCRYPTION_KEY
openssl rand -hex 24   # STRAVA_WEBHOOK_VERIFY_TOKEN
openssl rand -hex 24   # TELEGRAM_WEBHOOK_SECRET
```

Put values in `.env` for:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=...
APP_ENCRYPTION_KEY=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_WEBHOOK_VERIFY_TOKEN=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
MODEL_PROVIDER_API_KEY=...
CHECKIN_INTERVAL_HOURS=24
```

**Notes:**
- `APP_ENCRYPTION_KEY` can be any strong secret string. The app hashes it to a 256-bit key internally.
- `CHECKIN_INTERVAL_HOURS` controls how often the worker sends proactive check-ins (default: 24).
- For self-hosted mode, `NEXT_PUBLIC_APP_URL` should be your VPS domain.
- For cloud mode, `NEXT_PUBLIC_APP_URL` should be your web app's deployed URL.

### Set up the model provider

The repo expects a single model-provider secret: `MODEL_PROVIDER_API_KEY`.

#### OpenRouter path (fastest)

1. Go to `https://openrouter.ai/`
2. Create an account or sign in.
3. Open the API key settings page.
4. Create a new API key.
5. Copy it into `.env`:

```bash
MODEL_PROVIDER_API_KEY=<your-openrouter-api-key>
```

**Notes:**
- OpenRouter is a routing layer; confirm which upstream model and pricing you want before wiring live inference.
- Because this app handles health-adjacent training context, prefer providers and settings that minimize prompt retention and training exposure.
- Rotate the key immediately if it is ever exposed in logs, screenshots, or pasted into a shared shell.

#### Azure-hosted model path

1. Create an Azure OpenAI or Azure AI Foundry resource.
2. Deploy a model in Azure.
3. Open the resource's keys/access page.
4. Copy one of the API keys into `.env`:

```bash
MODEL_PROVIDER_API_KEY=<your-azure-model-api-key>
```

**Note:** The repo currently validates only `MODEL_PROVIDER_API_KEY`. If you later wire Azure-hosted inference with a custom endpoint URL or deployment name, you will need to extend the env contract in `packages/integrations/src/env.ts`.

## Step 2: Self-host locally

Run the full stack on your laptop using Docker Compose for end-to-end testing.

**Prerequisites:**
- Docker and Docker Compose installed
- `.env` file filled in with Strava, Telegram, and model provider credentials (see Step 1)
- For webhook testing: ngrok or cloudflared tunnel to expose port 3000 publicly

**Steps:**

1. Start the stack:
```bash
npm run selfhost:up
```

This command:
- Starts a local Postgres database
- Runs database migrations
- Starts the web app on `http://localhost:3000`
- Starts the worker in the background

2. Verify the stack is healthy:
```bash
curl http://localhost:3000/api/health
```

3. Open the dashboard:
```bash
open http://localhost:3000
```

4. For webhook testing, set up a tunnel in a separate terminal:
```bash
ngrok http 3000
# or
cloudflared tunnel --url https://myapp.example.com --http localhost:3000
```

5. Use the tunnel URL to configure Strava OAuth and Telegram webhook (see Steps 5 and 6 below).

6. Stop the stack when done:
```bash
npm run selfhost:down
```

**Useful commands:**
```bash
npm run selfhost:logs      # tail all service logs
npm run selfhost:logs web  # tail web app logs only
npm run db:studio          # inspect Postgres schema and data (interactive UI)
```

## Step 3: Self-host on a VPS

Deploy the same stack to a production VPS for continuous operation.

**Prerequisites:**
- Linux VPS (Ubuntu 22.04 or similar) with Docker and Docker Compose
- Static IP or DNS hostname
- SSL certificate for your domain (Let's Encrypt recommended)
- `.env` file with production Strava, Telegram, and model provider credentials

**Steps:**

1. SSH into your VPS.

2. Clone the repo:
```bash
git clone https://github.com/jessephus/coachinclaw.git
cd coachinclaw
cp .env.example .env
# Edit .env with your production credentials
```

3. Start the stack:
```bash
npm run selfhost:up
```

Or use docker-compose directly:
```bash
docker compose up -d
```

4. Verify health:
```bash
curl https://your-vps-domain/api/health
```

5. Configure Strava and Telegram webhooks using your VPS domain.

**Maintenance commands:**
```bash
# View logs
docker compose logs -f web

# Update the app (pull latest code, rebuild images, restart)
git pull
docker compose down
docker compose up -d --build

# Backup the database
docker compose exec postgres pg_dump -U athlete_user coach_db > backup.sql

# Restore from backup
cat backup.sql | docker compose exec -T postgres psql -U athlete_user coach_db
```

## Step 4: Cloud deployment (distributed)

Use this if you prefer managed services across multiple platforms.

### 4.1 Provision the Postgres database

This repo expects a normal Postgres connection string in `DATABASE_URL`. Use **Neon**, **Supabase**, **Railway**, or a Vercel-linked provider.

1. Create a hosted Postgres database.
2. Copy its connection string into `.env` as `DATABASE_URL`.
3. Run migrations from your local machine:

```bash
npm install
npm run db:migrate
```

4. Inspect the schema locally if needed:

```bash
npm run db:studio
```

### 4.2 Smoke-test locally before cloud deployment

Start the web app locally:

```bash
npm run dev:web
```

Open:
- `http://localhost:3000`
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/integrations`

**Checks:**
1. The home page loads.
2. `/api/health` returns `status: "ok"`.
3. `/api/integrations` shows which env vars are configured.
4. The Strava connect route exists at `/api/strava/connect`.

If you also want to run the worker locally:

```bash
npm run dev:worker
```

**Notes:**
- The worker sends an **immediate** check-in on startup once real Telegram credentials are configured.
- If required worker env vars are missing, it falls back to demo mode and prints a preview instead of sending.

### 4.3 Configure Telegram

#### Create the bot

1. In Telegram, open **@BotFather**.
2. Run `/newbot`.
3. Save the bot token BotFather gives you as `TELEGRAM_BOT_TOKEN` in `.env`.

#### Get your chat ID

1. Start a chat with your bot.
2. Send it a message such as `/start`.
3. Fetch updates (before registering a webhook):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates"
```

4. Find `message.chat.id` in the JSON response and store that as `TELEGRAM_CHAT_ID`.

**Note:** Once a webhook is active, `getUpdates` is no longer the normal path, so get the chat ID first.

#### Register the webhook (after your web app is deployed)

Your Telegram webhook endpoint is:

```text
https://<your-domain>/api/telegram/webhook
```

Register it through the app's helper endpoint:

```bash
curl -X POST "https://<your-domain>/api/telegram/setup-webhook" \
  -H "content-type: application/json" \
  -d '{"webhookUrl":"https://<your-domain>/api/telegram/webhook"}'
```

Verify the webhook on Telegram's side:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

**What happens:**
- Telegram sends webhook calls with the `X-Telegram-Bot-Api-Secret-Token` header.
- This repo checks that header against `TELEGRAM_WEBHOOK_SECRET`.
- Only messages from `TELEGRAM_CHAT_ID` are accepted.

### 4.4 Configure Strava

#### Create the Strava app

1. Go to `https://www.strava.com/settings/api`.
2. Create a developer application.
3. Save the generated **Client ID** and **Client Secret** into `.env`:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`

#### Set the callback domain

This repo's OAuth callback route is:

```text
/api/strava/callback
```

For local work, the app URL is usually:

```text
http://localhost:3000
```

For production, it is your deployed web URL:

```text
https://<your-domain>
```

**Suggestion:** Use one Strava app for local/dev, and a separate Strava app for production.

#### Test the OAuth flow

Once the web app is running and env vars are set, open:

```text
http://localhost:3000/api/strava/connect
```

or, in production:

```text
https://<your-domain>/api/strava/connect
```

After you approve the app in Strava:

1. The callback route stores tokens.
2. An athlete profile is created if needed.
3. An initial activity sync runs.

#### Create the Strava webhook subscription

Your Strava webhook endpoint is:

```text
https://<your-domain>/api/strava/webhook
```

Create the subscription:

```bash
curl -X POST "https://www.strava.com/api/v3/push_subscriptions" \
  -F client_id="<STRAVA_CLIENT_ID>" \
  -F client_secret="<STRAVA_CLIENT_SECRET>" \
  -F callback_url="https://<your-domain>/api/strava/webhook" \
  -F verify_token="<STRAVA_WEBHOOK_VERIFY_TOKEN>"
```

This repo handles Strava's verification challenge by validating:

1. `hub.mode=subscribe`
2. `hub.verify_token`
3. Returning `{ "hub.challenge": ... }`

#### Run a manual sync

Trigger a manual sync after connecting Strava:

```bash
curl -X POST "https://<your-domain>/api/strava/sync?days=30&pageLimit=2"
```

### 4.5 Deploy the web app

#### Vercel path

1. Import the repo into Vercel.
2. Deploy the Next app from `apps/web`.
3. Add the same environment variables, but change `NEXT_PUBLIC_APP_URL` to your deployed URL.
4. Redeploy after env vars are in place.

After deploy:

1. Run the Telegram webhook setup call.
2. Create the Strava webhook subscription.
3. Test `/api/health`.
4. Test `/api/strava/connect`.

#### Railway path

Use this if you want web app, worker, and Postgres in one platform.

**Suggested service split:**

1. **Postgres service**
2. **Web service**
   - build command: `npm run build --workspace /web`
   - start command: `npm run start --workspace /web`
3. **Worker service**
   - start command: `npx tsx apps/worker/src/index.ts`

#### Azure path

This is the recommended Azure setup for this repo:

1. **Azure Database for PostgreSQL Flexible Server**
2. **Azure App Service (Linux, Node 22)** for the Next.js app
3. **Azure Container Apps** for the worker

**Why this split:**
- App Service is the straightforward home for a normal Next.js server.
- PostgreSQL Flexible Server is the Azure-native managed Postgres option.
- Container Apps is a better home for the persistent worker than Azure Functions.
- Azure OpenAI or Azure AI Foundry keeps model-provider credentialing inside Azure.

**Azure setup checklist:**

1. Create a resource group.
2. Create a PostgreSQL Flexible Server instance.
3. Allow your app hosts to connect to the database.
4. Create an App Service plan and Web App for `apps/web`.
5. Create a Container Apps environment and a worker app for `apps/worker`.
6. Create Azure OpenAI or Azure AI Foundry model access if Azure will be your model provider.
7. Set the same environment variables on both services.
8. Run database migrations.
9. Point Strava and Telegram at the Azure-hosted web URL.

**Azure database setup:**

1. Service: **Azure Database for PostgreSQL Flexible Server**
2. Tier: start with a small **Burstable** SKU for hobby usage
3. Networking: simplest initial setup is public access with tight firewall rules

After provisioning:

1. Copy the Postgres connection string into `DATABASE_URL`
2. Ensure SSL settings in the Azure connection string are preserved
3. Run migrations:

```bash
npm run db:migrate
```

You can run migrations from your local machine as long as your IP is allowed by the server firewall.

**Azure web app setup:**

Use **Azure App Service on Linux** with **Node 22**.

1. Create an App Service Plan.
2. Create a Web App in that plan.
3. Connect it to the repo through GitHub deployment or deploy from local/CI.
4. Add environment variables in the Web App configuration.

**Web app environment variables:**

```bash
NEXT_PUBLIC_APP_URL=https://<your-azure-web-app-domain>
DATABASE_URL=...
APP_ENCRYPTION_KEY=...
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_WEBHOOK_VERIFY_TOKEN=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
MODEL_PROVIDER_API_KEY=...
```

**Build and start commands:**

1. build: `npm run build --workspace /web`
2. start: `npm run start --workspace /web`

After deployment:

1. Open `/api/health`
2. Open `/api/integrations`
3. Test `/api/strava/connect`

**Azure worker setup:**

Use **Azure Container Apps** for the worker.

**Why:**
- The worker is a long-running Node process.
- It needs to keep running and send periodic check-ins.
- Azure Functions is the wrong shape for this.

**Worker environment variables:**

```bash
DATABASE_URL=...
APP_ENCRYPTION_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
MODEL_PROVIDER_API_KEY=...
CHECKIN_INTERVAL_HOURS=24
```

**Worker command:**

```bash
npx tsx apps/worker/src/index.ts
```

**Configuration:**
1. Keep at least one replica available.
2. Use the same app secrets as the web app where relevant.
3. Check logs after startup. The worker will either:
   - Enter demo mode if env vars are missing, or
   - Send a real Telegram check-in immediately.

**Azure deployment order:**

1. Create PostgreSQL Flexible Server.
2. Fill in `.env` locally and test with `npm run dev:web`.
3. Create Azure OpenAI or Azure AI Foundry if Azure will host the model layer.
4. Deploy the web app to Azure App Service.
5. Set all web app environment variables.
6. Run migrations against the Azure database.
7. Deploy the worker to Azure Container Apps.
8. Set worker environment variables.
9. Configure Telegram webhook against the Azure web app URL.
10. Configure Strava OAuth and webhook against the Azure web app URL.
11. Trigger a manual Strava sync.

### 4.6 Deploy the worker

The worker is a long-running process with `setInterval(...)`, so it is **not** a good fit for normal Vercel serverless execution.

Run it on Railway, Render, Fly.io, or another process host with these env vars:

```bash
DATABASE_URL=...
APP_ENCRYPTION_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
MODEL_PROVIDER_API_KEY=...
CHECKIN_INTERVAL_HOURS=24
```

**Recommended worker start command:**

```bash
npx tsx apps/worker/src/index.ts
```

## Step 5: End-to-end checklist

Once everything is configured, follow this order for a clean first run:

1. Start or deploy the web app.
2. Run database migrations.
3. Configure Telegram and confirm the webhook.
4. Configure Strava and complete `/api/strava/connect`.
5. Create the Strava webhook subscription.
6. Trigger `/api/strava/sync`.
7. Start the worker.
8. Confirm you receive a Telegram check-in.

## Privacy and security baseline

- **Model provider:** Ensure your model provider agreement includes clauses about prompt retention, training data usage, and health data handling.
- **Database:** Use encryption at rest and in transit. Consider a managed provider (Neon, Supabase, Azure) that handles this automatically.
- **Secrets:** Never commit `.env` files or hardcode secrets. Rotate API keys regularly.
- **Webhooks:** Always verify webhook signatures (Telegram, Strava) before processing inbound data.
- **Telegram:** The worker deliberately sends short, non-medical Telegram messages. Sensitive detail (injury context, medical notes) stays in the database.
