import { eq } from "drizzle-orm";

import { readEnvVar } from "@coachinclaw/integrations";

import { createDatabaseConnection, type DatabaseClient } from "./client";
import { decryptString, encryptString } from "./crypto";
import {
  integrationConfigs,
  type IntegrationConfigProvider,
  type IntegrationConfigRow,
} from "./schema";

export type StravaIntegrationConfig = {
  clientId: string;
  clientSecret: string;
  webhookVerifyToken: string | null;
};

export type TelegramIntegrationConfig = {
  botToken: string;
  chatId: string;
  webhookSecret: string;
};

export type ModelProviderIntegrationConfig = {
  apiKey: string;
  baseUrl: string | null;
  model: string | null;
};

export type IntegrationConfigSource = "database" | "environment" | "missing";

export type IntegrationConfigStatus = {
  provider: IntegrationConfigProvider;
  configured: boolean;
  source: IntegrationConfigSource;
};

export async function getStoredStravaIntegrationConfig(db?: DatabaseClient) {
  return getStoredConfig<StravaIntegrationConfig>("strava", db);
}

export async function getStoredTelegramIntegrationConfig(db?: DatabaseClient) {
  return getStoredConfig<TelegramIntegrationConfig>("telegram", db);
}

export async function getStoredModelProviderIntegrationConfig(db?: DatabaseClient) {
  return getStoredConfig<ModelProviderIntegrationConfig>("model-provider", db);
}

export async function upsertStravaIntegrationConfig(
  config: StravaIntegrationConfig,
  db?: DatabaseClient,
) {
  return upsertConfig("strava", normalizeStravaConfig(config), db);
}

export async function upsertTelegramIntegrationConfig(
  config: TelegramIntegrationConfig,
  db?: DatabaseClient,
) {
  return upsertConfig("telegram", normalizeTelegramConfig(config), db);
}

export async function upsertModelProviderIntegrationConfig(
  config: ModelProviderIntegrationConfig,
  db?: DatabaseClient,
) {
  return upsertConfig("model-provider", normalizeModelProviderConfig(config), db);
}

export async function getResolvedStravaIntegrationConfig(db?: DatabaseClient) {
  const stored = await getStoredStravaIntegrationConfig(db);
  if (isStravaConfigComplete(stored)) {
    return { config: stored, source: "database" as const };
  }

  const envConfig = normalizeStravaConfig({
    clientId: readEnvVar("STRAVA_CLIENT_ID") ?? "",
    clientSecret: readEnvVar("STRAVA_CLIENT_SECRET") ?? "",
    webhookVerifyToken: readEnvVar("STRAVA_WEBHOOK_VERIFY_TOKEN"),
  });

  if (isStravaConfigComplete(envConfig)) {
    return { config: envConfig, source: "environment" as const };
  }

  return { config: null, source: "missing" as const };
}

export async function getResolvedTelegramIntegrationConfig(db?: DatabaseClient) {
  const stored = await getStoredTelegramIntegrationConfig(db);
  if (isTelegramConfigComplete(stored)) {
    return { config: stored, source: "database" as const };
  }

  const envConfig = normalizeTelegramConfig({
    botToken: readEnvVar("TELEGRAM_BOT_TOKEN") ?? "",
    chatId: readEnvVar("TELEGRAM_CHAT_ID") ?? "",
    webhookSecret: readEnvVar("TELEGRAM_WEBHOOK_SECRET") ?? "",
  });

  if (isTelegramConfigComplete(envConfig)) {
    return { config: envConfig, source: "environment" as const };
  }

  return { config: null, source: "missing" as const };
}

export async function getResolvedModelProviderIntegrationConfig(db?: DatabaseClient) {
  const stored = await getStoredModelProviderIntegrationConfig(db);
  if (isModelProviderConfigComplete(stored)) {
    return { config: stored, source: "database" as const };
  }

  const envConfig = normalizeModelProviderConfig({
    apiKey: readEnvVar("MODEL_PROVIDER_API_KEY") ?? "",
    baseUrl: readEnvVar("MODEL_PROVIDER_BASE_URL"),
    model: readEnvVar("MODEL_PROVIDER_MODEL"),
  });

  if (isModelProviderConfigComplete(envConfig)) {
    return { config: envConfig, source: "environment" as const };
  }

  return { config: null, source: "missing" as const };
}

export async function getResolvedIntegrationConfigStatuses(db?: DatabaseClient): Promise<
  IntegrationConfigStatus[]
> {
  const [strava, telegram, modelProvider] = await Promise.all([
    getResolvedStravaIntegrationConfig(db),
    getResolvedTelegramIntegrationConfig(db),
    getResolvedModelProviderIntegrationConfig(db),
  ]);

  return [
    {
      provider: "strava",
      configured: strava.config !== null,
      source: strava.source,
    },
    {
      provider: "telegram",
      configured: telegram.config !== null,
      source: telegram.source,
    },
    {
      provider: "model-provider",
      configured: modelProvider.config !== null,
      source: modelProvider.source,
    },
  ];
}

function normalizeStravaConfig(config: StravaIntegrationConfig): StravaIntegrationConfig {
  return {
    clientId: config.clientId.trim(),
    clientSecret: config.clientSecret.trim(),
    webhookVerifyToken: normalizeOptional(config.webhookVerifyToken),
  };
}

function normalizeTelegramConfig(config: TelegramIntegrationConfig): TelegramIntegrationConfig {
  return {
    botToken: config.botToken.trim(),
    chatId: config.chatId.trim(),
    webhookSecret: config.webhookSecret.trim(),
  };
}

function normalizeModelProviderConfig(
  config: ModelProviderIntegrationConfig,
): ModelProviderIntegrationConfig {
  return {
    apiKey: config.apiKey.trim(),
    baseUrl: normalizeOptional(config.baseUrl),
    model: normalizeOptional(config.model),
  };
}

function normalizeOptional(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isStravaConfigComplete(config: StravaIntegrationConfig | null): config is StravaIntegrationConfig {
  return Boolean(config?.clientId && config?.clientSecret);
}

function isTelegramConfigComplete(
  config: TelegramIntegrationConfig | null,
): config is TelegramIntegrationConfig {
  return Boolean(config?.botToken && config?.chatId && config?.webhookSecret);
}

function isModelProviderConfigComplete(
  config: ModelProviderIntegrationConfig | null,
): config is ModelProviderIntegrationConfig {
  return Boolean(config?.apiKey);
}

async function getStoredConfig<T>(provider: IntegrationConfigProvider, db?: DatabaseClient) {
  const operation = async (database: DatabaseClient) => {
    const row = await database.query.integrationConfigs.findFirst({
      where: (table, { eq: eqFn }) => eqFn(table.provider, provider),
    });

    if (!row) {
      return null;
    }

    return parseStoredConfig<T>(row);
  };

  if (db) {
    return operation(db);
  }

  return withDatabase(operation);
}

async function upsertConfig<T extends Record<string, unknown>>(
  provider: IntegrationConfigProvider,
  config: T,
  db?: DatabaseClient,
) {
  const operation = async (database: DatabaseClient) => {
    const now = new Date();
    const values = {
      provider,
      configCiphertext: encryptString(JSON.stringify(config)),
      updatedAt: now,
    };

    const [row] = await database
      .insert(integrationConfigs)
      .values(values)
      .onConflictDoUpdate({
        target: [integrationConfigs.provider],
        set: values,
      })
      .returning();

    return row;
  };

  if (db) {
    return operation(db);
  }

  return withDatabase(operation);
}

function parseStoredConfig<T>(row: IntegrationConfigRow): T {
  return JSON.parse(decryptString(row.configCiphertext)) as T;
}

async function withDatabase<T>(operation: (db: DatabaseClient) => Promise<T>) {
  const connection = createDatabaseConnection();
  try {
    return await operation(connection.db);
  } finally {
    await connection.close();
  }
}
