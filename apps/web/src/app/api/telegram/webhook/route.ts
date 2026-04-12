// ---------------------------------------------------------------------------
// POST /api/telegram/webhook
//
// Receives inbound Telegram webhook updates. Security model:
//   1. Verify X-Telegram-Bot-Api-Secret-Token before any body parsing.
//   2. Filter updates to the configured TELEGRAM_CHAT_ID.
//   3. Reject oversized messages (prompt-injection surface reduction).
//   4. Always return 200 to Telegram after the secret check passes, even for
//      filtered updates, to prevent retries from leaking timing information.
//
// No sensitive content is logged. Only redacted audit metadata is emitted.
// ---------------------------------------------------------------------------

import { type NextRequest, NextResponse } from "next/server";

import {
  buildMessagePreview,
  filterInboundUpdate,
  type TelegramUpdate,
  verifyWebhookSecret,
} from "@coachinclaw/integrations";
import { extractMemoriesFromInboundMessage, getResolvedTelegramIntegrationConfig } from "@coachinclaw/db";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const telegram = await getResolvedTelegramIntegrationConfig();
  if (!telegram.config) {
    return NextResponse.json(
      { ok: false, error: "Telegram integration is not configured." },
      { status: 500 },
    );
  }
  const webhookSecret = telegram.config.webhookSecret;
  const allowedChatId = telegram.config.chatId;

  // 1. Verify the webhook secret before touching the request body.
  const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(headerSecret, webhookSecret)) {
    console.warn("[telegram/webhook] rejected: invalid secret token");
    // Return 403 — a spoofed caller should not receive 200 ack.
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // 2. Parse the update body.
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  // 3. Filter: chat ID guard + text presence + length cap.
  const filterResult = filterInboundUpdate(update, allowedChatId);

  if (!filterResult.accepted) {
    console.warn(
      `[telegram/webhook] filtered update_id=${update.update_id ?? "unknown"} reason=${filterResult.reason}`,
    );
    // Return 200 so Telegram does not keep retrying filtered updates.
    return NextResponse.json({ ok: true, filtered: true });
  }

  // 4. Emit audit metadata — never the full message body.
  const preview = buildMessagePreview(filterResult.text);
  console.log(
    `[telegram/webhook] accepted update_id=${filterResult.updateId} message_id=${filterResult.messageId} preview_chars=${preview.length}`,
  );

  const extracted = await extractMemoriesFromInboundMessage({
    externalMessageId: String(filterResult.messageId),
    body: filterResult.text,
    channel: "telegram",
    metadata: {
      telegramChatId: filterResult.chatId,
      telegramMessageId: filterResult.messageId,
      telegramUpdateId: filterResult.updateId,
    },
  });

  return NextResponse.json({
    ok: true,
    storedMemories: extracted.storedMemories.map((memory) => ({
      category: memory.category,
      title: memory.title,
      detail: memory.detail,
    })),
  });
}
