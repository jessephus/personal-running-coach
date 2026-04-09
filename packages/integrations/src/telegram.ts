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
