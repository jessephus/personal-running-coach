"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  upsertModelProviderIntegrationConfig,
  upsertStravaIntegrationConfig,
  upsertTelegramIntegrationConfig,
} from "@coachinclaw/db";

export async function saveStravaConfigAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clientSecret = String(formData.get("clientSecret") ?? "").trim();
  const webhookVerifyToken = String(formData.get("webhookVerifyToken") ?? "").trim();

  if (!clientId || !clientSecret) {
    redirect("/tech-config/strava?error=missing-required");
  }

  await upsertStravaIntegrationConfig({
    clientId,
    clientSecret,
    webhookVerifyToken: webhookVerifyToken || null,
  });

  revalidatePath("/tech-config");
  revalidatePath("/tech-config/strava");
  redirect("/tech-config/strava?saved=1");
}

export async function saveTelegramConfigAction(formData: FormData) {
  const botToken = String(formData.get("botToken") ?? "").trim();
  const chatId = String(formData.get("chatId") ?? "").trim();
  const webhookSecret = String(formData.get("webhookSecret") ?? "").trim();

  if (!botToken || !chatId || !webhookSecret) {
    redirect("/tech-config/telegram?error=missing-required");
  }

  await upsertTelegramIntegrationConfig({
    botToken,
    chatId,
    webhookSecret,
  });

  revalidatePath("/tech-config");
  revalidatePath("/tech-config/telegram");
  redirect("/tech-config/telegram?saved=1");
}

export async function saveModelProviderConfigAction(formData: FormData) {
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();

  if (!apiKey) {
    redirect("/tech-config/model-provider?error=missing-required");
  }

  await upsertModelProviderIntegrationConfig({
    apiKey,
    baseUrl: baseUrl || null,
    model: model || null,
  });

  revalidatePath("/tech-config");
  revalidatePath("/tech-config/model-provider");
  redirect("/tech-config/model-provider?saved=1");
}
