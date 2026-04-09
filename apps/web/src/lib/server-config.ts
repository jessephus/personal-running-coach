type EnvironmentStatus = {
  key: string;
  configured: boolean;
  description: string;
};

type ServerConfig = {
  appUrl: string;
  stravaClientId: string | null;
  stravaClientSecretConfigured: boolean;
  telegramBotTokenConfigured: boolean;
  telegramChatIdConfigured: boolean;
  telegramWebhookSecretConfigured: boolean;
  modelProviderApiKeyConfigured: boolean;
};

export function getServerConfig(): ServerConfig {
  return {
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    stravaClientId: process.env.STRAVA_CLIENT_ID ?? null,
    stravaClientSecretConfigured: Boolean(process.env.STRAVA_CLIENT_SECRET),
    telegramBotTokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramChatIdConfigured: Boolean(process.env.TELEGRAM_CHAT_ID),
    telegramWebhookSecretConfigured: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    modelProviderApiKeyConfigured: Boolean(process.env.MODEL_PROVIDER_API_KEY),
  };
}

export function getEnvironmentStatus(): EnvironmentStatus[] {
  const config = getServerConfig();

  return [
    {
      key: "STRAVA_CLIENT_ID",
      configured: Boolean(config.stravaClientId),
      description: "Needed to start the Strava OAuth flow.",
    },
    {
      key: "STRAVA_CLIENT_SECRET",
      configured: config.stravaClientSecretConfigured,
      description: "Needed to exchange Strava authorization codes securely.",
    },
    {
      key: "TELEGRAM_BOT_TOKEN",
      configured: config.telegramBotTokenConfigured,
      description: "Needed to send coach nudges and receive Telegram updates.",
    },
    {
      key: "TELEGRAM_CHAT_ID",
      configured: config.telegramChatIdConfigured,
      description: "Used to constrain the MVP to the intended athlete chat.",
    },
    {
      key: "TELEGRAM_WEBHOOK_SECRET",
      configured: config.telegramWebhookSecretConfigured,
      description: "Used to verify inbound Telegram webhook calls.",
    },
    {
      key: "MODEL_PROVIDER_API_KEY",
      configured: config.modelProviderApiKeyConfigured,
      description: "Used for external frontier-model calls with privacy controls.",
    },
  ];
}
