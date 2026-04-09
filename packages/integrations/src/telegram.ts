import { createHash, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const telegramEnvironmentKeys = [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "TELEGRAM_WEBHOOK_SECRET",
] as const;

export const telegramWebhookGuidance = {
  deliveryModel: "Use Telegram only for concise nudges and check-ins in MVP.",
  guardrails: [
    "Do not send detailed injury or medical notes through Telegram.",
    "Require the webhook secret header before accepting inbound updates.",
    "Treat the bot token as a high-risk credential.",
  ],
};

/**
 * MVP cap on inbound message length accepted before prompt assembly.
 * Longer messages are rejected outright to limit prompt-injection surface.
 */
export const INBOUND_MAX_CHARS = 500;

/**
 * MVP cap on outbound message length. Telegram's hard limit is 4096, but we
 * enforce a tighter bound to keep messages concise (per messaging constraints).
 */
export const OUTBOUND_MAX_CHARS = 500;

// ---------------------------------------------------------------------------
// Telegram Bot API types (minimal subset for MVP)
// ---------------------------------------------------------------------------

export type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
};

export type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

// ---------------------------------------------------------------------------
// Webhook secret verification
// ---------------------------------------------------------------------------

/**
 * Constant-time comparison of the X-Telegram-Bot-Api-Secret-Token header
 * value against the configured TELEGRAM_WEBHOOK_SECRET.
 *
 * Both values are hashed to a fixed-length digest before comparison so that
 * differing lengths do not create a timing oracle. Never logs either value.
 */
export function verifyWebhookSecret(
  headerValue: string | null | undefined,
  expectedSecret: string,
): boolean {
  if (!headerValue) return false;
  try {
    const a = createHash("sha256").update(headerValue).digest();
    const b = createHash("sha256").update(expectedSecret).digest();
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Inbound update filtering
// ---------------------------------------------------------------------------

export type InboundFilterResult =
  | {
      accepted: true;
      chatId: string;
      text: string;
      updateId: number;
      messageId: number;
    }
  | {
      accepted: false;
      reason: "wrong-chat" | "no-text" | "text-too-long" | "empty-update";
    };

/**
 * Validates and filters an inbound Telegram update.
 *
 * - Rejects updates from chats other than allowedChatId (MVP single-athlete guard).
 * - Rejects non-text messages.
 * - Rejects messages exceeding INBOUND_MAX_CHARS (prompt-injection surface reduction).
 *
 * The raw text is never logged by this function. Callers should store only
 * encrypted body + a truncated preview per the messaging constraint policy.
 */
export function filterInboundUpdate(
  update: TelegramUpdate,
  allowedChatId: string,
): InboundFilterResult {
  if (!update.message) {
    return { accepted: false, reason: "empty-update" };
  }

  const msg = update.message;
  const chatId = String(msg.chat.id);

  if (chatId !== String(allowedChatId)) {
    return { accepted: false, reason: "wrong-chat" };
  }

  if (!msg.text) {
    return { accepted: false, reason: "no-text" };
  }

  if (msg.text.length > INBOUND_MAX_CHARS) {
    return { accepted: false, reason: "text-too-long" };
  }

  return {
    accepted: true,
    chatId,
    text: msg.text,
    updateId: update.update_id,
    messageId: msg.message_id,
  };
}

/**
 * Returns a safe preview of an inbound message for audit logs and DB bodyPreview.
 * Truncates to 80 chars and never includes the full body.
 */
export function buildMessagePreview(text: string, maxChars = 80): string {
  const trimmed = text.trim();
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed;
}

// ---------------------------------------------------------------------------
// Per-chat rate limiter (in-memory, MVP single-instance)
// ---------------------------------------------------------------------------

/** Minimum gap between outbound messages to the same chat (1 msg/sec). */
const RATE_LIMIT_MIN_INTERVAL_MS = 1_000;

export type RateLimitCheck =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

export class TelegramRateLimiter {
  private readonly lastSentAt = new Map<string, number>();

  check(chatId: string): RateLimitCheck {
    const last = this.lastSentAt.get(chatId) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed >= RATE_LIMIT_MIN_INTERVAL_MS) {
      return { allowed: true };
    }
    return { allowed: false, retryAfterMs: RATE_LIMIT_MIN_INTERVAL_MS - elapsed };
  }

  record(chatId: string): void {
    this.lastSentAt.set(chatId, Date.now());
  }
}

// ---------------------------------------------------------------------------
// Telegram client
// ---------------------------------------------------------------------------

export type SendMessageResult =
  | { ok: true; messageId: number }
  | { ok: false; error: string; rateLimited?: boolean; retryAfterMs?: number };

export type TelegramClient = {
  /** Sends a text message. Enforces OUTBOUND_MAX_CHARS and rate limiting. */
  sendMessage(chatId: string, text: string): Promise<SendMessageResult>;
  /** Calls getMe to confirm the token is valid and the bot is reachable. */
  isAlive(): Promise<boolean>;
};

/**
 * Creates a thin Telegram Bot API client.
 *
 * Security notes:
 * - The bot token is captured in closure — never returned or logged.
 * - Outbound text is truncated to OUTBOUND_MAX_CHARS before sending.
 * - Calls are rate-limited to protect against accidental floods.
 */
export function createTelegramClient(
  botToken: string,
  rateLimiter?: TelegramRateLimiter,
): TelegramClient {
  const limiter = rateLimiter ?? new TelegramRateLimiter();
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  return {
    async sendMessage(chatId: string, text: string): Promise<SendMessageResult> {
      const check = limiter.check(chatId);
      if (!check.allowed) {
        return {
          ok: false,
          error: "rate limited",
          rateLimited: true,
          retryAfterMs: check.retryAfterMs,
        };
      }

      const body =
        text.length > OUTBOUND_MAX_CHARS ? text.slice(0, OUTBOUND_MAX_CHARS) : text;

      try {
        const response = await fetch(`${baseUrl}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: body }),
        });

        limiter.record(chatId);

        if (!response.ok) {
          const errBody = (await response
            .json()
            .catch(() => ({}))) as TelegramApiResponse<unknown>;
          return {
            ok: false,
            error: errBody.description ?? response.statusText,
          };
        }

        const data = (await response.json()) as TelegramApiResponse<TelegramMessage>;
        if (!data.ok || !data.result) {
          return { ok: false, error: data.description ?? "Telegram returned ok=false" };
        }
        return { ok: true, messageId: data.result.message_id };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "unknown fetch error",
        };
      }
    },

    async isAlive(): Promise<boolean> {
      try {
        const response = await fetch(`${baseUrl}/getMe`);
        const data = (await response.json()) as TelegramApiResponse<TelegramUser>;
        return data.ok === true;
      } catch {
        return false;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Webhook registration helper
// ---------------------------------------------------------------------------

export type WebhookSetupResult =
  | { ok: true; webhookUrl: string }
  | { ok: false; error: string };

/**
 * Registers a webhook URL with the Telegram Bot API.
 *
 * The secretToken is sent to Telegram so they can include it in every
 * subsequent webhook call as X-Telegram-Bot-Api-Secret-Token. This value
 * should equal TELEGRAM_WEBHOOK_SECRET.
 *
 * Only subscribes to "message" updates (no unnecessary data exposure).
 */
export async function setupTelegramWebhook(
  botToken: string,
  webhookUrl: string,
  secretToken: string,
): Promise<WebhookSetupResult> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secretToken,
          allowed_updates: ["message"],
        }),
      },
    );

    const data = (await response.json()) as TelegramApiResponse<boolean>;
    if (!data.ok) {
      return { ok: false, error: data.description ?? "Unknown Telegram API error" };
    }
    return { ok: true, webhookUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown fetch error",
    };
  }
}
