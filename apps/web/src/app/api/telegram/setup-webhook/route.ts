// ---------------------------------------------------------------------------
// POST /api/telegram/setup-webhook
//
// Developer utility: registers the webhook URL with the Telegram Bot API so
// that Telegram will POST inbound updates to /api/telegram/webhook.
//
// This endpoint is intentionally minimal — it is a one-time setup step run
// during deployment. It does not expose any stored credentials in its response.
//
// Usage:
//   POST /api/telegram/setup-webhook
//   Body: { "webhookUrl": "https://your-domain/api/telegram/webhook" }
// ---------------------------------------------------------------------------

import { type NextRequest, NextResponse } from "next/server";

import {
  setupTelegramWebhook,
} from "@coachinclaw/integrations";
import { getResolvedTelegramIntegrationConfig } from "@coachinclaw/db";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const telegram = await getResolvedTelegramIntegrationConfig();
  if (!telegram.config) {
    return NextResponse.json(
      {
        ok: false,
        error: "Telegram is not configured. Add it from the Tech Config page first.",
      },
      { status: 400 },
    );
  }

  let body: { webhookUrl?: unknown };
  try {
    body = (await request.json()) as { webhookUrl?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (typeof body.webhookUrl !== "string" || !body.webhookUrl.startsWith("https://")) {
    return NextResponse.json(
      { ok: false, error: "webhookUrl must be a valid https URL" },
      { status: 400 },
    );
  }

  const result = await setupTelegramWebhook(
    telegram.config.botToken,
    body.webhookUrl,
    telegram.config.webhookSecret,
  );

  if (!result.ok) {
    console.error("[telegram/setup-webhook] registration failed:", result.error);
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
  }

  // Log only that registration succeeded and which URL — not the token.
  console.log(`[telegram/setup-webhook] registered: ${result.webhookUrl}`);
  return NextResponse.json({ ok: true, webhookUrl: result.webhookUrl });
}
